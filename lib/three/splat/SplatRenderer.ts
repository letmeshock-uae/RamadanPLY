/**
 * SplatRenderer — renders 3D Gaussian Splats as camera-facing billboard quads.
 *
 * Uses THREE.ShaderMaterial (not Raw) so that three.js automatically:
 *   - injects modelViewMatrix, projectionMatrix, position, normal uniforms/attrs
 *   - handles WebGL2 / GLSL 3.00 ES compatibility (#define attribute in, etc.)
 *   - provides gl_FragColor via the pc_fragColor alias
 *
 * Blending: premultiplied alpha (src=ONE, dst=ONE_MINUS_SRC_ALPHA).
 * depthWrite: false — splats don't occlude each other.
 * Back-to-front sorting every SORT_INTERVAL frames.
 */
import * as THREE from 'three';

const SORT_INTERVAL = 8;

const vertexShader = /* glsl */ `
uniform float uPointScale;

in vec3 aColor;
in float aOpacity;
in float aScale;

out vec2 vUv;
out vec3 vColor;
out float vOpacity;

void main() {
  vColor   = aColor;
  vOpacity = aOpacity;
  vUv      = normal.xy;        // normal repurposed as corner offset

  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);

  // NDC radius: world-space scale / perspective depth
  float ndcRadius = uPointScale * aScale / max(-viewPos.z, 0.0001);

  vec4 clipPos = projectionMatrix * viewPos;

  // Aspect correction so the billboard is circular in screen pixels.
  // projectionMatrix[1][1] / projectionMatrix[0][0] = (w/h) for standard persp.
  float aspectCorrect = projectionMatrix[1][1] / projectionMatrix[0][0];

  clipPos.x += normal.x * ndcRadius * clipPos.w;
  clipPos.y += normal.y * ndcRadius * aspectCorrect * clipPos.w;

  gl_Position = clipPos;
}
`;

// ─── Fragment Shader ──────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
in vec2 vUv;
in vec3 vColor;
in float vOpacity;

layout(location = 0) out vec4 fragColor;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  // Gaussian falloff — soft edges, fully opaque at centre
  float alpha = exp(-3.0 * r2) * vOpacity;
  if (alpha < 0.003) discard;

  // Premultiplied alpha for correct over-compositing
  fragColor = vec4(vColor * alpha, alpha);
}
`;

// ─── SplatRenderer ────────────────────────────────────────────────────────────
export class SplatRenderer {
  mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private vertexCount: number;
  private positions: Float32Array;
  private sortedIndices: Uint32Array;
  private frameCount = 0;

  constructor(data: Record<string, Float32Array>) {
    const n = data['x']?.length ?? 0;
    this.vertexCount = n;

    const QUAD_VERTS = 4;
    const QUAD_INDICES = 6;
    // Corner offsets stored in the 'normal' attribute (z=0, unused)
    const CORNERS: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

    const posArr = new Float32Array(n * QUAD_VERTS * 3);
    const normArr = new Float32Array(n * QUAD_VERTS * 3);
    const colorArr = new Float32Array(n * QUAD_VERTS * 3);
    const opacityArr = new Float32Array(n * QUAD_VERTS);
    const scaleArr = new Float32Array(n * QUAD_VERTS);
    const indexArr = new Uint32Array(n * QUAD_INDICES);

    this.positions = new Float32Array(n * 3);
    this.sortedIndices = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.sortedIndices[i] = i;

    const x = data['x'] ?? new Float32Array(n);
    const y = data['y'] ?? new Float32Array(n);
    const z = data['z'] ?? new Float32Array(n);

    // Colour: prefer SH DC coefficients, then uint8 rgb
    const rCh = data['f_dc_0'] ?? data['red'] ?? data['diffuse_red'] ?? null;
    const gCh = data['f_dc_1'] ?? data['green'] ?? data['diffuse_green'] ?? null;
    const bCh = data['f_dc_2'] ?? data['blue'] ?? data['diffuse_blue'] ?? null;

    const opacity = data['opacity'] ?? null;
    const sx = data['scale_0'] ?? null;
    const sy = data['scale_1'] ?? null;
    const sz = data['scale_2'] ?? null;

    const isUcharColor = !!(rCh && rCh.length > 0 && rCh[0] > 1.5);

    for (let i = 0; i < n; i++) {
      const px = x[i], py = y[i], pz = z[i];
      this.positions[i * 3] = px;
      this.positions[i * 3 + 1] = py;
      this.positions[i * 3 + 2] = pz;

      // ── Colour ─────────────────────────────────────────────────────────
      // SH DC → linear RGB: color ≈ 0.5 + coeff × C0 (C0 = 1/(2√π) ≈ 0.28209)
      let cr = 0.85, cg = 0.65, cb = 0.25;
      if (rCh && gCh && bCh) {
        if (isUcharColor) {
          cr = rCh[i] / 255; cg = gCh[i] / 255; cb = bCh[i] / 255;
        } else {
          cr = Math.min(1, Math.max(0, 0.5 + rCh[i] * 0.2820948));
          cg = Math.min(1, Math.max(0, 0.5 + gCh[i] * 0.2820948));
          cb = Math.min(1, Math.max(0, 0.5 + bCh[i] * 0.2820948));
        }
      }

      // ── Opacity ────────────────────────────────────────────────────────
      // 3DGS stores logit(opacity); convert with sigmoid
      let op = 0.8;
      if (opacity) op = 1.0 / (1.0 + Math.exp(-opacity[i]));

      // ── Scale ──────────────────────────────────────────────────────────
      // 3DGS stores log(scale); use exp(max axis) as billboard half-width
      let scale = 0.003;
      if (sx && sy && sz) scale = Math.exp(Math.max(sx[i], sy[i], sz[i]));

      for (let q = 0; q < QUAD_VERTS; q++) {
        const vi = i * QUAD_VERTS + q;
        posArr[vi * 3] = px;
        posArr[vi * 3 + 1] = py;
        posArr[vi * 3 + 2] = pz;
        normArr[vi * 3] = CORNERS[q][0];
        normArr[vi * 3 + 1] = CORNERS[q][1];
        normArr[vi * 3 + 2] = 0;
        colorArr[vi * 3] = cr;
        colorArr[vi * 3 + 1] = cg;
        colorArr[vi * 3 + 2] = cb;
        opacityArr[vi] = op;
        scaleArr[vi] = scale;
      }

      const ib = i * QUAD_INDICES;
      const vb = i * QUAD_VERTS;
      indexArr[ib] = vb; indexArr[ib + 1] = vb + 1;
      indexArr[ib + 2] = vb + 2; indexArr[ib + 3] = vb;
      indexArr[ib + 4] = vb + 2; indexArr[ib + 5] = vb + 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colorArr, 3));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacityArr, 1));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scaleArr, 1));
    geometry.setIndex(new THREE.BufferAttribute(indexArr, 1));
    this.geometry = geometry;

    // ShaderMaterial (not Raw) — three.js handles GLSL version compat,
    // built-in uniforms (modelViewMatrix, projectionMatrix) and attributes
    // (position, normal) automatically.
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,
      uniforms: {
        uPointScale: { value: 3.0 },
      },
    });
    this.material = material;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Called from SceneCanvas once scene bounds are known.
   * Boost uPointScale for small scenes where gaussian sigma is tiny relative
   * to the orbit distance.
   */
  setPointScale(halfMaxDim: number): void {
    const boost = Math.max(3.0, 0.5 / Math.max(halfMaxDim, 0.0001));
    this.material.uniforms['uPointScale'].value = boost;
  }

  /** Back-to-front sort — throttled by SORT_INTERVAL. */
  sort(camera: THREE.Camera): void {
    this.frameCount++;
    if (this.frameCount % SORT_INTERVAL !== 0) return;

    const n = this.vertexCount;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    const depths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = this.positions[i * 3] - cx;
      const dy = this.positions[i * 3 + 1] - cy;
      const dz = this.positions[i * 3 + 2] - cz;
      depths[i] = dx * dx + dy * dy + dz * dz;
    }
    this.sortedIndices.sort((a, b) => depths[b] - depths[a]);

    const QUAD_VERTS = 4;
    const QUAD_INDICES = 6;
    const indexArr = new Uint32Array(n * QUAD_INDICES);
    for (let si = 0; si < n; si++) {
      const i = this.sortedIndices[si];
      const ib = si * QUAD_INDICES;
      const vb = i * QUAD_VERTS;
      indexArr[ib] = vb; indexArr[ib + 1] = vb + 1;
      indexArr[ib + 2] = vb + 2; indexArr[ib + 3] = vb;
      indexArr[ib + 4] = vb + 2; indexArr[ib + 5] = vb + 3;
    }

    const indexAttr = this.geometry.index as THREE.BufferAttribute;
    (indexAttr.array as Uint32Array).set(indexArr);
    indexAttr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
