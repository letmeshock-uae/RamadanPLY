/**
 * SplatRenderer — renders 3D Gaussian Splats as camera-facing billboard quads.
 *
 * Strategy:
 *   - Each gaussian = 4 vertices (quad), so geometry = vertexCount * 4 vertices.
 *   - Corner offsets stored in the `normal` attribute (repurposed as vec2 [-1,1]).
 *   - Per-splat attributes (color, opacity, scale) are interleaved across all 4 corners.
 *   - Back-to-front sorting done every SORT_INTERVAL frames via squared camera distance.
 *   - Custom shader: gaussian falloff in frag, billboard expansion in vert.
 *
 * Blending:
 *   - depthWrite: false   — splats don't occlude each other; order is from sort.
 *   - depthTest: true     — splats hide behind solid geometry.
 *   - Premultiplied alpha blending for correct over-compositing.
 */
import * as THREE from 'three';

const SORT_INTERVAL = 8; // re-sort every N frames

// ─── Vertex Shader ──────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute vec3 normal;    // repurposed: xy = corner offset in [-1,1]
attribute vec3 aColor;
attribute float aOpacity;
attribute float aScale;

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

uniform float uPointScale;

void main() {
  vColor   = aColor;
  vOpacity = aOpacity;
  vUv      = normal.xy;

  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);

  // Perspective-correct screen size from scale and depth
  float screenSize = uPointScale * aScale / max(-viewPos.z, 0.001);

  vec4 clipPos = projectionMatrix * viewPos;

  // Expand the billboard in clip space
  float aspect = projectionMatrix[0][0] / projectionMatrix[1][1];
  clipPos.x += normal.x * screenSize * clipPos.w;
  clipPos.y += normal.y * screenSize * aspect * clipPos.w;

  gl_Position = clipPos;
}
`;

// ─── Fragment Shader ─────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;

void main() {
  // 2D gaussian falloff
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;

  float alpha = exp(-3.0 * r2) * vOpacity;
  if (alpha < 0.004) discard;

  // Premultiplied alpha for correct blending
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`;

// ─── SplatRenderer class ─────────────────────────────────────────────────────
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

    const QUAD_VERTS = 4;
    const QUAD_INDICES = 6;

    // Each quad has 4 corners with these offsets
    const CORNERS: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

    const posArr     = new Float32Array(n * QUAD_VERTS * 3);
    const normArr    = new Float32Array(n * QUAD_VERTS * 3);
    const colorArr   = new Float32Array(n * QUAD_VERTS * 3);
    const opacityArr = new Float32Array(n * QUAD_VERTS);
    const scaleArr   = new Float32Array(n * QUAD_VERTS);
    const indexArr   = new Uint32Array(n * QUAD_INDICES);

    this.positions = new Float32Array(n * 3);

    const x = data['x'] ?? new Float32Array(n);
    const y = data['y'] ?? new Float32Array(n);
    const z = data['z'] ?? new Float32Array(n);

    // Color: prefer SH DC components, then rgb channels
    const r = data['f_dc_0'] ?? data['red'] ?? data['diffuse_red'] ?? null;
    const g = data['f_dc_1'] ?? data['green'] ?? data['diffuse_green'] ?? null;
    const b = data['f_dc_2'] ?? data['blue'] ?? data['diffuse_blue'] ?? null;

    const opacity = data['opacity'] ?? null;
    const sx = data['scale_0'] ?? null;
    const sy = data['scale_1'] ?? null;
    const sz = data['scale_2'] ?? null;

    const isUcharColor = !!(r && r.length > 0 && r[0] > 1.0);

    this.sortedIndices = new Uint32Array(n);
    for (let i = 0; i < n; i++) this.sortedIndices[i] = i;

    for (let i = 0; i < n; i++) {
      const px = x[i], py = y[i], pz = z[i];
      this.positions[i * 3]     = px;
      this.positions[i * 3 + 1] = py;
      this.positions[i * 3 + 2] = pz;

      // Color: SH DC → RGB via approximate linear mapping
      let cr = 0.85, cg = 0.65, cb = 0.25; // warm gold fallback
      if (r && g && b) {
        if (isUcharColor) {
          cr = r[i] / 255;
          cg = g[i] / 255;
          cb = b[i] / 255;
        } else {
          // SH DC: approx color = 0.5 + coeff * C0 (C0 ≈ 0.28209)
          cr = Math.min(1, Math.max(0, 0.5 + r[i] * 0.2820948));
          cg = Math.min(1, Math.max(0, 0.5 + g[i] * 0.2820948));
          cb = Math.min(1, Math.max(0, 0.5 + b[i] * 0.2820948));
        }
      }

      // Opacity: 3DGS stores logit(opacity), convert with sigmoid
      let op = 0.8;
      if (opacity) {
        const raw = opacity[i];
        op = Math.min(1, Math.max(0, 1 / (1 + Math.exp(-raw))));
      }

      // Scale: 3DGS stores log(scale), convert with exp
      let scale = 0.04;
      if (sx && sy && sz) {
        const avgLogScale = (sx[i] + sy[i] + sz[i]) / 3;
        scale = Math.min(0.5, Math.max(0.001, Math.exp(avgLogScale)));
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

      // Quad triangles: 0-1-2 and 0-2-3
      const ib   = i * QUAD_INDICES;
      const vb   = i * QUAD_VERTS;
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
        uPointScale: { value: 1.5 },
      },
    });
    this.material = material;

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
  }

  /** Back-to-front sort — throttled by SORT_INTERVAL */
  sort(camera: THREE.Camera): void {
    this.frameCount++;
    if (this.frameCount % SORT_INTERVAL !== 0) return;

    const n = this.vertexCount;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    // Squared distance for each splat
    const depths = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const dx = this.positions[i * 3]     - cx;
      const dy = this.positions[i * 3 + 1] - cy;
      const dz = this.positions[i * 3 + 2] - cz;
      depths[i] = dx * dx + dy * dy + dz * dz;
    }

    // Sort back-to-front (descending distance)
    this.sortedIndices.sort((a, b) => depths[b] - depths[a]);

    // Rebuild index buffer in sorted order
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
