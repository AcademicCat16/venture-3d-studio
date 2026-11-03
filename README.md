# Venture 3D Studio

**Live studio:** https://academiccat16.github.io/venture-3d-studio/

A browser-based 3D product design studio for Mission 2. Turn a concept into an editable 3D model, customise it, and export a confirmed handoff for your Mission 3 website. Nothing to install, no account, and no paid services.

## Student guide

1. **Open the studio.** Your product is already there as an editable 3D model: the Travel Jewelry Organizer, built by Codex from the Mission 1 concept images. Your concept images appear in the Reference strip at the bottom left.
2. **Explore.**
   - Drag to orbit, scroll to zoom, and right-drag to pan.
   - The toolbar has Front, Side, Top, Back and Isometric views, plus Persp/Ortho for a flat, measured view.
3. **Select a part.** Click the model, or choose a part in **Objects** on the left. Selecting a group (▸) moves its whole component.
4. **Make a change.** Use the panel on the right:
   - **Move, rotate, resize:** drag the coloured arrows, or type exact numbers. Shortcuts: W move, E rotate, R resize.
   - **Real size:** type a new width, height or depth in centimetres.
   - **Shape:** change the radius, length and other settings.
   - **Material & colour:** pick a preset (leather, gold, fabric…), a colour, and how rough, metallic or transparent it is. Use **Apply to all matching parts** to recolour every part that shares that colour.
   - **Texture & logo:** upload an image as a surface pattern, or place your logo as a decal.
   - **Feature note:** explain why the part matters. Notes become hotspots on your Mission 3 website.
5. **Save.** Work autosaves in this browser.
   - **Project › Save version** keeps a restorable version.
   - **Download project file** makes a backup you can open on any computer.
6. **Confirm Model.** Click the gold button at the top right. The studio checks the scene, exports a GLB, re-loads it to verify it, captures a preview and packages everything. Then click **Download Venture_3D_Confirmed_Handoff.zip**.
7. **Mission 3.** Keep the ZIP intact and attach it to your Mission 3 prompt.

Undo with Ctrl+Z, redo with Ctrl+Shift+Z, and delete a selected part with Del. Seven other templates (bottle, box, bag, mascot, mug, café corner, sculpture) are under **Templates**.

### What's in the handoff ZIP

| File | Purpose |
|---|---|
| `model.glb` | The confirmed 3D model (glTF binary, metres, Y-up) |
| `model-manifest.json` | Schema `venture-3d-handoff` 1.0.0: names, type, timestamp, measured dimensions, camera framing, lighting, description, feature hotspots, file list, SHA-256 checksums |
| `project.json` | Editable project with all images embedded. Open it in the studio to keep editing. |
| `preview.png` | Product preview image |
| `README.txt` | Instructions for Mission 3 |

### Honest limits

- **No automatic image-to-3D.** The studio does not reconstruct 3D from a 2D image. The starting model was built by Codex during development from the concept images, using editable parametric parts. Students can also start from a template.
- **Browser storage is per browser.** It can be cleared, so download a project file as a backup.
- **Material settings and GLB.** Leather grain and fabric weave are simplified, and sheen, clearcoat and transmission export as standard glTF extensions. Some viewers ignore these extensions.

## Development

```bash
npm install
npm run dev                 # local studio
npm run build               # type-check + production build
node tests/e2e.mjs          # end-to-end test (needs Google Chrome)
npm run deploy              # publish to GitHub Pages (gh-pages branch)
```

Stack: React 19, TypeScript, Vite, Three.js 0.170, React Three Fiber, Drei, Zustand, fflate. One project format drives both the viewport and the GLB exporter (`src/model/build.ts`), so the export matches what students see.
