# Ramadan / Eid Web Card — 3DGS (PLY) + SVG Logos + Typography (Antigravity VibeCode Instruction)

> Goal: build a **single-page celebratory web card** (Ramadan Kareem / Eid Mubarak) with a **beautifully animated 3D Gaussian Splatting scene** rendered from a **PLY** file, **two SVG logos layered on top**, and a **background headline “Ramadan Kareem”** in **Playfair Display**.

This document is written as a **production-ready VibeCode instruction** for **Antigravity**: it defines scope, file structure, implementation steps, and acceptance criteria.  
No dead UI: everything visible must be wired and working.

---

## 1) Deliverable

A responsive web page (desktop + mobile) with:

1. **3D scene layer**  
   - Loads and renders a **PLY** file (the 3DGS/point data).
   - Animates camera / scene subtly (cinematic, calm).
   - Has a fallback if advanced splats are unavailable (still shows something meaningful).

2. **Typography layer (behind 3D)**  
   - A large “Ramadan Kareem” (or “Eid Mubarak”) text behind the 3D scene.
   - Font: **Playfair Display** (Google Fonts or self-hosted).
   - Subtle parallax / gentle opacity blend.

3. **Overlay layer (above 3D)**  
   - Two SVG logos (e.g., ministry + product).
   - Positioned with safe margins, scales responsibly, stays crisp.

4. **UI controls (minimal)**  
   - Toggle: **Ramadan Kareem ↔ Eid Mubarak**.
   - Toggle: **Reduced motion** (respects `prefers-reduced-motion` automatically).
   - Share button (copies URL to clipboard + small toast).

5. **Performance**  
   - Smooth on modern devices.  
   - Avoid jank; cap DPR; progressive loading; show a clean loader.

---

## 2) Tech Stack (default)

- **Next.js (App Router) + TypeScript**
- **three.js** for WebGL
- **Playfair Display** via `next/font/google` (or local font if required)
- SVG logos as static assets (`/public/brand/*.svg`)
- Styling: **TailwindCSS** (or plain CSS modules if you prefer)
- Optional: **zustand** for tiny UI state (can be done with React state if simpler)

---

## 3) Important clarification about “3DGS PLY”

There are two common “PLY” cases:

### A) Regular point cloud PLY (xyz + rgb)
- Can be loaded with `PLYLoader` in three.js and rendered as points.
- Looks OK but is **not** true Gaussian splatting.

### B) 3D Gaussian Splat PLY (contains extra per-point gaussian attributes)
- May include attributes like `scale_*`, `rot_*`, `opacity`, and SH coefficients (often `f_dc_*`, `f_rest_*`).
- Needs a **splat renderer** (screen-space ellipses, blending, sorting).

**Instruction:** implement **both paths**:
- Try 3DGS attribute detection and render using a splat renderer path.
- If attributes not present / renderer unavailable → fallback to point cloud rendering.

This ensures the app works with more files and never “breaks”.

---

## 4) Project structure (must match)

```
ramadan-card/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    CardScene.tsx
    SceneCanvas.tsx
    OverlayLogos.tsx
    HeadlineBehind.tsx
    Controls.tsx
    Toast.tsx
  lib/
    ply/
      detect3dgs.ts
      loadPly.ts
      parsePlyBinary.ts
      parsePlyAscii.ts
    three/
      createRenderer.ts
      createCameraRig.ts
      createLights.ts
      fitCameraToBounds.ts
      splat/
        SplatRenderer.ts
        shaders/
          splat.vert.glsl
          splat.frag.glsl
  public/
    models/
      scene.ply
    brand/
      logo-1.svg
      logo-2.svg
  README.md
```

---

## 5) Page layout (layering)

Use a single full-viewport card with 3 layers:

1. **Background text** (z-index: 0)  
2. **3D canvas** (z-index: 1)  
3. **SVG overlays + controls** (z-index: 2)

### Layout rules
- Canvas must fill the card container.
- Keep safe padding: `clamp(16px, 3vw, 40px)` from edges for logos and controls.
- Support 16:9-ish framing on desktop, but keep center focus on mobile.

---

## 6) Implementation plan (step-by-step)

### Step 0 — Bootstrap
1. Create Next.js app with TS.
2. Add Tailwind (optional but recommended).
3. Add three.js.
4. Add `next/font/google` for Playfair Display.

Acceptance:
- `/` renders a full-viewport page with basic layers and no console errors.

---

### Step 1 — Build the UI skeleton
Implement components:

- `HeadlineBehind`  
  - big text centered, behind canvas  
  - uses Playfair Display  
  - supports two modes: Ramadan / Eid

- `OverlayLogos`  
  - top-left and top-right logos (or stacked on mobile)

- `Controls`  
  - three actions: Mode toggle, Reduced motion, Share

- `Toast`  
  - minimal, used by Share

Acceptance:
- All controls work; share copies URL; reduced motion state is stored (localStorage).

---

### Step 2 — WebGL canvas + camera rig
Implement `SceneCanvas`:
- Creates three.js scene, camera, renderer.
- Uses `requestAnimationFrame` loop.
- Uses DPR cap: `Math.min(window.devicePixelRatio, 1.75)` (or 1.5 for safety).
- Handles resize properly.

Implement camera rig:
- Slow orbit + micro “breathing” movement.
- If reduced motion → static camera.

Acceptance:
- You see a neutral background (e.g., transparent canvas over background).
- No memory leaks on route reload (dispose renderer, geometries, textures).

---

### Step 3 — PLY loading pipeline
Implement `lib/ply/loadPly.ts`:
- Fetch PLY from `/public/models/scene.ply`.
- Detect if ASCII or binary PLY.
- Parse header to list properties & vertex count.
- Load into typed arrays.

Implement `detect3dgs.ts`:
- Return `{ is3dgs: boolean, reason: string }`
- Detect presence of typical 3DGS properties:
  - `opacity`
  - any `scale` fields
  - any `rot` / quaternion fields
  - SH fields like `f_dc_0..2` etc.

Acceptance:
- Loader prints a **single** log line in dev: file type, vertex count, 3dgs detection result.

---

### Step 4 — Rendering path A: True-ish splats (3DGS)
Implement `SplatRenderer`:
- Input: typed arrays of 3DGS attributes.
- Output: a three.js `Mesh` (or `Points`) with custom shader material that renders screen-space splats.

Minimum viable splat rendering:
- Each point is rendered as a camera-facing quad (billboard).
- Quad size derived from gaussian scale and distance.
- Alpha blending controlled by opacity.
- Optional: approximate color from SH DC component (`f_dc_*`) or rgb if present.

Sorting:
- For acceptable quality: do **back-to-front** sorting each few frames (not every frame).
- Use view-space z to sort indices.
- If sorting is too heavy → sort at load + re-sort every N frames.

Acceptance:
- On a known 3DGS PLY, splats appear soft and volumetric, not sharp points.
- FPS stays reasonable. If device struggles, auto-enables low-quality mode.

---

### Step 5 — Rendering path B: Point cloud fallback
If PLY is not 3DGS:
- Render with `THREE.Points` using `BufferGeometry`.
- Use `PointsMaterial` with size attenuation + subtle opacity.
- Optional: custom shader for round points (not squares).

Acceptance:
- Any xyz(+rgb) PLY renders as a clean point cloud and matches camera rig.

---

### Step 6 — Cinematic polish
Add:
- Subtle vignette via CSS overlay (not heavy postprocessing).
- Soft glow on highlights (optional simple screen blend overlay).
- “Ramadan Kareem” behind the 3D: slight parallax with pointer movement (disabled in reduced motion).
- Loader: progress bar or spinner while parsing.

Acceptance:
- The result feels like a premium web card, not a tech demo.

---

## 7) Key engineering constraints

### Rendering correctness
- Avoid z-fighting artifacts.
- Correct alpha blending order matters for splats:
  - Use `transparent: true`
  - `depthWrite: false`
  - `depthTest: true` (or false depending on artifact; document the choice)
- Background should be controlled (transparent canvas over typography layer).

### Performance
- Throttle sorting:
  - Re-sort every ~6–12 frames (or every 100–200ms).
- Clamp DPR.
- Use `requestAnimationFrame` + pause when tab hidden (`visibilitychange`).

### Accessibility
- Respect `prefers-reduced-motion`.
- Ensure controls are keyboard-accessible.
- High contrast for UI labels.

---

## 8) Concrete acceptance checklist (Definition of Done)

### Visual / UX
- [ ] Full-screen card works from 360px wide to 4K.
- [ ] Background headline uses Playfair Display and is behind the 3D.
- [ ] Two SVG logos sit on top, remain crisp, never overlap critical content.
- [ ] Toggle switches between “Ramadan Kareem” and “Eid Mubarak”.
- [ ] Reduced motion stops camera/parallax animations.
- [ ] Share button copies URL and shows a toast.

### 3D
- [ ] PLY loads without console errors.
- [ ] If 3DGS attributes exist: render as soft splats.
- [ ] If not: render as point cloud fallback.
- [ ] Resize works; no stretched aspect; camera remains framed.
- [ ] Cleanup on unmount disposes GPU resources.

### Performance
- [ ] Stable FPS on typical laptops/phones (no runaway memory).
- [ ] Sorting is throttled and does not freeze UI.
- [ ] DPR clamped.

---

## 9) Implementation notes (what Antigravity must do)

### Fonts
Use:
- `next/font/google` → `Playfair_Display` with subsets `latin` (and `arabic` only if you add Arabic text).
- Apply the font only to the headline layer so UI can remain neutral sans.

### SVG Logos
- Put SVG files into `/public/brand/`.
- Use `<img src="/brand/logo-1.svg" />` for simplicity, or inline via SVGR if you need CSS control.
- Make sure their viewBox is correct; keep `max-width` via CSS.

### PLY parsing
- Implement both ASCII and binary little-endian.
- Keep parsing in a Web Worker if it’s heavy (optional enhancement).
- If you skip Worker: show loader; avoid blocking too long.

### Splat shader (MVP)
- Vertex shader:
  - transform point to view space
  - compute screen size from gaussian scale and depth
  - expand to quad in clip space
- Fragment shader:
  - compute 2D gaussian falloff from quad UV
  - alpha = opacity * falloff
  - color = rgb or SH DC
  - premultiply alpha for better blending

---

## 10) Nice-to-have upgrades (optional after MVP)

- Add a subtle “crescent” particle layer in 2D (CSS canvas) behind splats.
- Add audio toggle (quiet ambient) with user gesture requirement.
- Add export to video/GIF (heavy; not required for MVP).
- Add localized Arabic line under headline (e.g., “رمضان كريم”) if desired.

---

## 11) README requirements

In `README.md`, include:
- How to run locally
- Where to drop the PLY (`public/models/scene.ply`)
- Where to drop logos (`public/brand/`)
- How 3DGS detection works (list the property names checked)
- Performance tips (DPR clamp, sorting throttle)

---

## 12) Final instruction to Antigravity

Build this as a **working product**, not a mock:

- Do not leave placeholder components.
- All toggles must change real behavior.
- The 3D must actually render from the PLY and animate.
- Provide clean, commented code in `lib/ply` and `lib/three/splat`.
- Ensure cleanup/disposal is correct to avoid GPU leaks.

