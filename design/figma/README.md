# RYDEPRO — editable Figma import

This package contains measured captures of the **current website**, an importer for native Figma text, image, SVG, and Auto Layout nodes, and matching desktop font files.

**Status:** six editable screens were imported and reviewed in [New Landing Page & Join Waitlist](https://www.figma.com/design/kuo3lWer6Becv3Wck9Ghzz/Customers-Infor-Web?node-id=1418-1528). The October 9 landing-page revision is complete in the website and source package; its Figma refresh is awaiting final verification after the Desktop Bridge stopped responding. The PNG files are website references, not Figma exports.

The latest landing page uses left-aligned split section headings, 14px desktop / 12px mobile body text, compact titles, and an image-free animated fleet with 36px vehicle-type pill buttons. The waitlist and driver styling are unchanged. Only the two landing frames are being refreshed in Figma; the existing waitlist and confirmation frames are retained.

## Screens

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Landing | 1440 × 9140 | 390 × 13473 |
| Join the waitlist | 1440 × 1534 | 390 × 2265 |
| Confirmation overlay | 1440 × 1000 | 390 × 844 |

The six screen JSON files and matching reference PNGs are in `source/`. Captures include the existing header/footer, Satoshi sizing, 36px rounded controls, current palette and strokes, original images and vector badges, all landing sections, the waitlist form, and the confirmation popup. The fleet is captured in its initial Premium Sedan state. Confirmation uses sample details: Alex Morgan, New York, and alex@example.com.

## Import directly in Figma Desktop

1. Install the three TTF files from `fonts/` if Figma does not already have a compatible Satoshi family. See the [font notes](fonts/README.md).
2. Open the target Figma Design file.
3. Choose **Plugins → Development → Import plugin from manifest** and select `plugin/manifest.json` from this folder.
4. Run **RYDEPRO Web to Auto Layout** under development plugins.
5. Select the six screen JSON files from `source/`, then choose **Import designs**. `assets.json` and `capture-summary.json` are metadata; the plugin ignores them if selected.

The direct importer creates or reuses a page named **RYDEPRO · Web design**, with Desktop and Mobile sections. Assisted import instead targets the existing **New Landing Page & Join Waitlist** section in the linked file. Text remains editable, SVG badges remain vectors, and images remain individual image layers. Flow containers use nested Auto Layout; genuine overlays and CSS decorations use positioned layers. Existing imported screens are retained by default, so rerunning the plugin does not duplicate or overwrite them.

The initial six screens were visually checked in Figma. Each new import should be compared with its reference PNGs: browser and Figma text, gradient, and shadow rendering can differ slightly. The importer reports unusual layouts that need inspection rather than claiming a guaranteed pixel match.

## Connect for assisted import and verification

Open the target file in Figma Desktop and run **Plugins → Development → Figma Desktop Bridge**. Keep that plugin open and share the file link. This allows the assistant to create the native frames, inspect their rendered screenshots, and adjust any mismatches.

If the bridge is not installed, use **Import plugin from manifest** with the path reported by the Figma connection tool. The direct importer above is an independent option and does not need a network connection.

## Regenerate the package

Run these commands from the project root:

```powershell
node scripts/capture-figma.mjs
python scripts/prepare-figma-fonts.py
node scripts/build-figma-plugin.mjs
```

The capture script uses an isolated headless Edge/Chromium profile and makes no changes to the website. The font helper uses FontTools and Node's Brotli decoder. The importer module can also be used from the connected Figma execution tool through its `importRydeproSnapshot` function.
