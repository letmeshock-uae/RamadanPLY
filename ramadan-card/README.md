# Ramadan Kareem / Eid Mubarak — 3DGS Web Card

An interactive, full-viewport web card that renders a **3D Gaussian Splatting** (or point cloud) PLY scene with animated camera, Playfair Display typography, and two SVG brand logos.

---

## Running locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

Build for production:

```bash
npm run build
npm start
```

---

## Assets

### PLY model
Drop your PLY file into:
```
public/models/scene.ply
```
The app detects ASCII vs binary format and 3DGS attributes automatically.

### Logos
Drop two SVG logos into:
```
public/brand/logo-1.svg   ← displayed top-left
public/brand/logo-2.svg   ← displayed top-right
```
Keep the `viewBox` attribute set correctly. The images scale responsively.

---

## 3DGS Detection

`lib/ply/detect3dgs.ts` checks for these property names in the PLY header:

| Category | Properties checked |
|----------|-------------------|
| Opacity | `opacity` |
| Scale | `scale_0`, `scale_1`, `scale_2` |
| Rotation | `rot_0`, `rot_1`, `rot_2`, `rot_3` |
| SH DC coefficients | `f_dc_0`, `f_dc_1`, `f_dc_2` |

If **opacity + any scale + any rot** are all present → 3DGS splat path.
If only SH coefficients found → also 3DGS.
Otherwise → point cloud fallback.

---

## Performance Tips

### DPR clamp
`lib/three/createRenderer.ts` clamps `devicePixelRatio` to **1.75**.
Lower to `1.5` for weaker devices.

### Sorting throttle
`lib/three/splat/SplatRenderer.ts` re-sorts back-to-front every **8 frames** (`SORT_INTERVAL`).
Increase to `12–16` if sorting causes jank on mobile.

### Visibility pause
The render loop pauses automatically when the tab is hidden (`visibilitychange`).

---

## Project structure

```
app/
  layout.tsx          Root layout (fonts, metadata)
  page.tsx            Full-viewport entry
  globals.css         Global styles + animations
  fonts.ts            Playfair Display via next/font/google
components/
  CardScene.tsx       Main state container + layer orchestrator
  SceneCanvas.tsx     WebGL three.js scene (client-only, dynamic import)
  HeadlineBehind.tsx  Background typography with parallax
  OverlayLogos.tsx    SVG logo overlay (top-left, top-right)
  Controls.tsx        Mode toggle, reduced motion, share button
  Toast.tsx           Clipboard share notification
lib/
  ply/
    detect3dgs.ts     Detects 3DGS attributes in PLY property list
    loadPly.ts        Fetches, parses header, dispatches to parsers
    parsePlyAscii.ts  ASCII PLY body parser
    parsePlyBinary.ts Binary little-endian PLY body parser
  three/
    createRenderer.ts WebGLRenderer factory (DPR clamp, alpha)
    createCameraRig.ts Slow orbit + breathing camera animation
    createLights.ts   Ambient + directional lights
    fitCameraToBounds.ts Auto-frames camera to bounding box
    splat/
      SplatRenderer.ts  3DGS billboard quad renderer + sorting
      shaders/
        splat.vert.glsl Camera-facing quad expansion
        splat.frag.glsl Gaussian falloff + premultiplied alpha
```
