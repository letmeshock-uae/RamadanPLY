/**
 * SplatRenderer — renders 3D Gaussian Splats as camera-facing billboard quads.
 *
 * Strategy:
 *   - Each gaussian = 4 vertices (quad).
 *   - Corner offsets stored in the `normal` attribute (xy = [-1,1]).
 *   - Scale stored as exp(max(scale_0, scale_1, scale_2)) — the largest axis.
 *   - uPointScale uniform set externally via setPointScale() to match scene size.
 *   - Back-to-front sorting every SORT_INTERVAL frames.
 *
 * Blending:
 *   - depthWrite: false, depthTest: true — correct for translucent splats.
 *   - Premultiplied alpha (src=ONE, dst=ONE_MINUS_SRC_ALPHA).
 */
import * as THREE from 'three';

const SORT_INTERVAL = 8;

// ─── Vertex Shader ────────────────────────────────────────────────────────────
// Expands each point into a camera-facing quad.
// aspect correction: projectionMatrix[1][1]/projectionMatrix[0][0] = width/height
// ensures the billboard is circular in screen pixels.
const vertexShader = /* glsl */ `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uPointScale;

attribute vec3 position;
attribute vec3 normal;    // xy = corner offset [-1,1], z unused
attribute vec3 aColor;
attribute float aOpacity;
attribute float aScale;   // world-space half-width of this gaussian

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor   = aColor;
  vOpacity = aOpacity;
  vUv      = normal.xy;

  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);

  // NDC radius: scale in world units / perspective depth
  float ndcRadius = uPointScale * aScale / max(-viewPos.z, 0.0001);

  vec4 clipPos = projectionMatrix * viewPos;

  // Correct aspect so the billboard is circular in pixels:
  // projectionMatrix[1][1] / projectionMatrix[0][0] = (w/h) for standard persp.
  float aspectCorrect = projectionMatrix[1][1] / projectionMatrix[0][0];

  clipPos.x += normal.x * ndcRadius * clipPos.w;
  clipPos.y += normal.y * ndcRadius * aspectCorrect * clipPos.w;

  gl_Position = clipPos;
}
`;

// ─── Fragment Shader ──────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  // Gaussian falloff — soft edge, fully opaque centre
  float alpha = exp(-3.0 * r2) * vOpacity;
  if (alpha < 0.003) discard;

  // Premultiplied alpha
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

// ─── SplatRenderer ────────────────────────────────────────────────────────────
export class SplatRenderer {
  mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.RawShaderMaterial;
  private vertexCount: number;
  private positions: Float32Array;
  private sortedIndices: Uint32Array;
  private frameCount = 0;

  constructor(data: Record<string, Float32Array>) {
    const n = data['x']?.length ?? 0;
    this.vertexCount = n;

    const QUAD_VERTS   = 4;
    const QUAD_INDICES = 6;
    const CORNERS: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

    const posArr     = new Float32Array(n * QUAD_VERTS * 3);
    const normArr    = new Float32Array(n * QUAD_VERTS * 3);
    const colorArr   = new Float32Array(n * QUAD_VERTS * 3);
    const opacityArr = new Float32Array(n * QUAD_VERTS);
    const scaleArr   = new Float32Array(n * QUAD_VERTS);
    const indexArr   = new Uint32Array(n * QUAD_INDICES);

    this.positions    = new Float32Array(n * 3);
    this.sortedIndices = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.sortedIndices[i] = i;

    const x = data['x'] ?? new Float32Array(n);
    const y = data['y'] ?? new Float32Array(n);
    const z = data['z'] ?? new Float32Array(n);

    // Color: SH DC coefficients or rgb channels
    const rCh = data['f_dc_0'] ?? data['red'] ?? data['diffuse_red'] ?? null;
    const gCh = data['f_dc_1'] ?? data['green'] ?? data['diffuse_green'] ?? null;
    const bCh = data['f_dc_2'] ?? data['blue'] ?? data['diffuse_blue'] ?? null;

    const opacity = data['opacity'] ?? null;
    const sx      = data['scale_0'] ?? null;
    const sy      = data['scale_1'] ?? null;
    const sz      = data['scale_2'] ?? null;

    // Detect if color channel is uint8 [0,255] or float (SH / normalised)
    const isUcharColor = !!(rCh && rCh.length > 0 && rCh[0] > 1.5);

    for (let i = 0; i < n; i++) {
      const px = x[i], py = y[i], pz = z[i];
      this.positions[i * 3]     = px;
      this.positions[i * 3 + 1] = py;
      this.positions[i * 3 + 2] = pz;

      // ── Color ──────────────────────────────────────────────────────────
      // SH DC → linear RGB: color ≈ 0.5 + coeff × C0 (C0 = 1/(2√π) ≈ 0.28209)
      let cr = 0.85, cg = 0.65, cb = 0.25; // warm gold fallback
      if (rCh && gCh && bCh) {
        if (isUcharColor) {
          cr = rCh[i] / 255;
          cg = gCh[i] / 255;
          cb = bCh[i] / 255;
        } else {
          cr = Math.min(1, Math.max(0, 0.5 + rCh[i] * 0.2820948));
          cg = Math.min(1, Math.max(0, 0.5 + gCh[i] * 0.2820948));
          cb = Math.min(1, Math.max(0, 0.5 + bCh[i] * 0.2820948));
        }
      }

      // ── Opacity ────────────────────────────────────────────────────────
      // 3DGS stores logit(opacity); convert with sigmoid
      let op = 0.8;
      if (opacity) {
        op = 1.0 / (1.0 + Math.exp(-opacity[i]));
      }

      // ── Scale ──────────────────────────────────────────────────────────
      // 3DGS stores log(scale); use exp(max axis) as billboard half-width.
      // No artificial clamp — keep the true Gaussian size.
      let scale = 1.0; // placeholder; overridden by setPointScale() if no data
      if (sx && sy && sz) {
        const maxLogScale = Math.max(sx[i], sy[i], sz[i]);
        scale = Math.exp(maxLogScale);
      }

      for (let q = 0; q < QUAD_VERTS; q++) {
        const vi = i * QUAD_VERTS + q;
        posArr[vi * 3]     = px;
        posArr[vi * 3 + 1] = py;
        posArr[vi * 3 + 2] = pz;
        normArr[vi * 3]     = CORNERS[q][0];
        normArr[vi * 3 + 1] = CORNERS[q][1];
        normArr[vi * 3 + 2] = 0;
        colorArr[vi * 3]     = cr;
        colorArr[vi * 3 + 1] = cg;
        colorArr[vi * 3 + 2] = cb;
        opacityArr[vi] = op;
        scaleArr[vi]   = scale;
      }

      const ib = i * QUAD_INDICES;
      const vb = i * QUAD_VERTS;
      indexArr[ib]     = vb;
      indexArr[ib + 1] = vb + 1;
      indexArr[ib + 2] = vb + 2;
      indexArr[ib + 3] = vb;
      indexArr[ib + 4] = vb + 2;
      indexArr[ib + 5] = vb + 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArr,     3));
    geometry.setAttribute('normal',   new THREE.BufferAttribute(normArr,    3));
    geometry.setAttribute('aColor',   new THREE.BufferAttribute(colorArr,   3));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacityArr, 1));
    geometry.setAttribute('aScale',   new THREE.BufferAttribute(scaleArr,   1));
    geometry.setIndex(new THREE.BufferAttribute(indexArr, 1));
    this.geometry = geometry;

    const material = new THREE.RawShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
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
   * `halfMaxDim` is half the bounding-box max dimension.
   *
   * uPointScale compensates for scenes where the gaussian sigma is very small
   * relative to the scene size (common in real 3DGS captures).
   * Target: splats render at ~15–30px radius on screen.
   */
  setPointScale(halfMaxDim: number): void {
    // For small scenes (halfMaxDim < 0.5 world units) boost more aggressively.
    const boost = Math.max(3.0, 0.5 / Math.max(halfMaxDim, 0.0001));
    this.material.uniforms['uPointScale'].value = boost;
  }

  /** Back-to-front sort — throttled by SORT_INTERVAL frames. */
  sort(camera: THREE.Camera): void {
    this.frameCount++;
    if (this.frameCount % SORT_INTERVAL !== 0) return;

    const n = this.vertexCount;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    const depths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = this.positions[i * 3]     - cx;
      const dy = this.positions[i * 3 + 1] - cy;
      const dz = this.positions[i * 3 + 2] - cz;
      depths[i] = dx * dx + dy * dy + dz * dz;
    }

    this.sortedIndices.sort((a, b) => depths[b] - depths[a]);

    const QUAD_VERTS   = 4;
    const QUAD_INDICES = 6;
    const indexArr = new Uint32Array(n * QUAD_INDICES);

    for (let si = 0; si < n; si++) {
      const i  = this.sortedIndices[si];
      const ib = si * QUAD_INDICES;
      const vb = i * QUAD_VERTS;
      indexArr[ib]     = vb;
      indexArr[ib + 1] = vb + 1;
      indexArr[ib + 2] = vb + 2;
      indexArr[ib + 3] = vb;
      indexArr[ib + 4] = vb + 2;
      indexArr[ib + 5] = vb + 3;
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
