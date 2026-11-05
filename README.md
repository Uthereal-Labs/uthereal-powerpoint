# Aurelia Slides

A dependency-free presentation editor written in plain HTML, CSS, and JavaScript, with a PowerPoint-style ribbon, slide thumbnails, property inspector, and speaker notes. The rendering engine uses WebGPU when available and falls back to Canvas 2D.

**Application:** https://wieslawsoltes.github.io/AureliaSlides/

## Run

Open `index.html` directly, or serve the repository locally:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/ for the standalone application or http://localhost:8000/dev.html for the native ES-module development entry point. There are no runtime packages, remote scripts, accounts, or external assets. Localhost or HTTPS is required for WebGPU. The status bar reports the active rendering backend.

## Develop and test

Node.js 22 or newer is required for the build and kernel tests; no `npm install` is necessary.

```sh
npm test
npm run check
npm run build
npm run build:site
```

`npm run build` deterministically regenerates the single-file `index.html` from `dev.html` and the six source modules. `npm run build:site` also stages only the deployable application in `_site/`.

## Features

- Canvas editing: selection and marquee, Shift-select, moving, resizing, rotation, nudge, alignment guides, snapping, zoom, and pan.
- Text boxes: inline editing, Unicode, wrapping, font selection, size, bold/italic/underline, paragraph alignment, line spacing, and bullets. The text-color palette preserves the selection and labels whether it affects selected words or entire text boxes; other formatting applies to the entire box.
- Objects: common vector shapes, lines, raster pictures, process diagrams, logical grouping, lock/hide, layering, duplicate, copy/paste, and transactional undo/redo. Shape tools show their active button, crosshair and native-shape preview; click the slide to place, drag to size, or press Esc to cancel.
- Slides: creation, duplication, deletion, renaming, drag ordering, slide sorter, layouts, themes, backgrounds, and dimensions.
- Data: editable single-series bar, line, and donut charts with a highlighted bar; tables with tab-separated data editing, relative column widths, per-column alignment, highlighted rows, optional banding and a table font.
- Themes: nine light and dark themes. Each defines color tokens (`@bg`, `@ink`, `@dark`, `@light`, `@accent`, `@secondary`, `@muted`, `@line`, `@surface`, `@highlight`) plus a `mode` and heading and body fonts for authors.
- Presentation: slideshow controller, notes panel, transitions, click-triggered entrances, laser pointer, blackout, and timer.
- Files: native `.aurelia` project format, browser-local autosave, PPTX export and best-effort import, PNG/SVG export, slide-image archives, and browser printing.
- Example: a seven-slide presentation built from editable objects.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/core.js` | Document model, validation, geometry, selection, transactions, undo/redo. |
| `src/layouts.js` | Adaptive layout membership, content validation, measurement, reflow, and copy/remap rules. |
| `src/renderer.js` | WebGPU pipelines and WGSL, instanced analytic shapes, cached text/image tiles, Canvas 2D fallback. |
| `src/demo.js` | Editable example presentation. |
| `src/icons.js` | Inline SVG UI icons. |
| `src/pptx.js` | ZIP reader/writer and PresentationML interchange. |
| `src/app.js` | Ribbon, interactions, inspector, persistence, file commands, slideshow controller. |
| `dev.html` | Editable HTML/CSS shell and module entry point. |
| `scripts/build.mjs` | Zero-dependency standalone bundler and Pages site staging. |
| `tests/core.test.mjs` | Kernel, geometry, history, chart/table expansion, validation, ZIP tests. |

The renderer preserves painter ordering, batches consecutive compatible shapes, grows instance buffers geometrically, and renders on demand. Browser text shaping/rasterization feeds cached GPU textures. Texture caching has a 96 MB soft budget. Moving a text box does not require rerasterizing its contents. Pointer gestures are single undoable transactions.

Text elements may carry optional `textColors` spans (`start`, `end`, `fill`), ordered and non-overlapping in UTF-16 offsets into the unchanged plain `text`. Editing rebases these ranges; rendering, native files, SVG and editable PPTX output retain them. Documents without spans keep their existing shape.

## GitHub Pages

The deployment workflow tests the source, rebuilds the standalone HTML, and publishes `_site/` using the official GitHub Pages actions. Configure **Settings → Pages → Build and deployment → Source → GitHub Actions** if the repository does not yet have Pages enabled.

Pages provides the secure origin needed by WebGPU, but hardware/browser availability still determines whether the GPU renderer can initialize.

## Validation and limitations

Run `pnpm test`, `pnpm check`, and `pnpm build` for the current native contract suite. It covers table geometry and editable export, grounding, and adaptive layout editing and persistence. Browser validation also covers manual text edits, undo, themes, save/reopen, export, and isolated viewer mode.

WebGPU hardware execution, secure-origin autosave, slideshow playback, and full PPTX round-trips have not been verified end-to-end. No frame-rate or production-readiness claim is made.

This is a working first implementation, not complete Microsoft PowerPoint parity. Missing areas include mixed font sizes/faces/emphasis within a text box, comprehensive slide-master inheritance, SmartArt, embedded media, collaboration, and native Office chart objects. PPTX charts and tables export as drawing objects; donut charts export as raster images. Generic PPTX import is best-effort. Save a native `.aurelia` project to preserve the editor's own document model.

The project is independently developed and is not affiliated with Microsoft.

## Adaptive layouts

The model or user chooses a layout and supplies content. The editor arranges it.
The catalog includes a horizontal process with 2–6 steps, a two-way comparison,
1–4 key figures, and a takeaway supported by points or an existing chart.

Each layout keeps ordinary editable objects as its only content source. The slide
stores their membership and order. Text and theme changes reflow those objects in
the same undo transaction. Copy and native import remap their references together.
Choose **Detach layout** to edit their geometry or managed appearance freely.
Locked members must be unlocked before changing their layout.

Colors use theme tokens. Text can use the `heading` or `body` font role. Choosing
an explicit font removes that role. All text measurement and output use the same
resolved font. A layout reports overflow when it cannot fit its content at a
readable size; it does not remove text or split slides automatically.

The native browser API exposes `layouts.create`, `update`, `detach`, `normalize`,
and `inspect`. Content fields follow the chosen layout type. Updates keep existing
item IDs to retain their text and associations. Layout output remains editable in
PowerPoint, but automatic reflow belongs to the native editor.

Table display, diagnostics, and PowerPoint export share `tableGeometry` and the
same native cell expansion. Hosts should consume this geometry rather than infer
cell positions from generated object IDs.

Set `globalThis.AURELIA_VIEWER = true` before loading the editor for a host-managed
viewer. This disables browser storage and autosave. The host remains responsible
for its sandbox, content security policy, and editing lock.

Native source associations survive edits to the same text or table element. Exact passage anchors rebase only for a unique exact quote; missing or ambiguous passages downgrade to object scope. Explicit removal/replacement stays authoritative. Save acknowledgements reconcile canonical anchors and origins only against matching submitted content, preserving later typing and Undo/Redo. The hosting service authorizes evidence and validates continuity; retention does not certify semantic support.
