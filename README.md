# Ramadan Kareem / Eid Mubarak — 3DGS Web Card

An interactive, full-viewport web card that renders a **3D Gaussian Splatting** (or point cloud) PLY scene with animated camera, Playfair Display typography, and two SVG brand logos.

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/letmeshock-uae/RamadanPLY&root=ramadan-card)

### One-click via Vercel dashboard

1. Push this repo to GitHub.
2. Import **`ramadan-card/`** as the **Root Directory** in Vercel.
3. Framework: **Next.js** (auto-detected).
4. Deploy — no environment variables required.

### Via Vercel CLI

```bash
cd ramadan-card
npm i -g vercel
vercel        # follow prompts, set root = ramadan-card
vercel --prod # promote to production
```

`vercel.json` is already included with correct headers for the PLY model file (long cache, correct MIME type).

---

## Running locally

```bash
cd ramadan-card
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
The scene PLY is pre-included at `public/models/scene.ply`.
To swap it, replace the file and redeploy — no code changes needed.
The app detects ASCII vs binary format and 3DGS attributes automatically.

### Logos
Drop two SVG logos into:
```
public/brand/logo-1.svg   ← displayed top-left
public/brand/logo-2.svg   ← displayed top-right
```
Placeholder logos are included. Keep the `viewBox` attribute set correctly.

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
ramadan-card/
  vercel.json           Vercel deployment config (headers, cache)
  app/
    layout.tsx          Root layout (Google Fonts link, metadata)
    page.tsx            Full-viewport entry
    globals.css         Global styles + .font-playfair utility
    fonts.ts            Playfair Display class name
  components/
    CardScene.tsx       Main state container + layer orchestrator
    SceneCanvas.tsx     WebGL three.js scene (client-only, dynamic import)
    HeadlineBehind.tsx  Background typography with pointer parallax
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
  public/
    models/scene.ply    3D scene (replace with your own PLY)
    brand/logo-1.svg    Top-left logo (replace with your own)
    brand/logo-2.svg    Top-right logo (replace with your own)
```
