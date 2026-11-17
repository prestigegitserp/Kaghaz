# Version 2 assets

`public/v2/models` contains geometry authored in Blender 4.3.2 using the committed `tools/assets/build_assets.py`. `public/v2/materials` is authored with the committed deterministic Pillow/NumPy generator. Color, roughness and tangent normal maps are separate. These are designed materials, not captured or calibrated scans. The three `public/v2/renders/*.webp` images are actual CPU Cycles renders of the source scene; no image-generation tool was used for these v2 images.

The earlier four-image atlas documented below is retained for repository history but no longer loaded by the v2 material library. The application and package licensing below continue to apply. Generated Persian label art uses DejaVu Sans in the authoring environment; label pixels are embedded in authored assets.

# Asset provenance and package licenses

## Original implementation

The new application, geometry builders, UI icons, catalog illustrations, Persian demo content and procedural fallback textures were authored for this project. Previous repositories were read for diagnosis and requirements; their implementation was not copied wholesale.

No real Baharestan scan, merchant logo, merchant photo, live price or claimed merchant partnership is included. Merchant names and inventory are illustrative. A generated material photograph is not described as a captured PBR material.

## Generated material atlas

`public/assets/brick.webp`, `plaster.webp`, `wood.webp`, `floor.webp` were extracted from a single generated four-quadrant atlas, resized and encoded for application use. Generation used the built-in image-generation tool. The source image was 1254 × 1254; each extracted quadrant was 627 × 627 and downsampled to 512 × 512 for delivery. The source image does not contain measured material detail. Generation did not produce measured normal/roughness maps. Runtime has procedural fallback textures.

Prompt used:

> Use case: photorealistic-natural. Asset type: one production material texture atlas for a realtime 3D traditional Persian paper-trading arcade, not a scene, no perspective. Create a high detail square image, exactly divided into four equally-sized quadrants without margins or borders. Each quadrant is a straight-on orthographic photograph of a flat real material surface, consistent soft neutral diffuse illumination with no cast shadows, no specular glare, no depth-of-field. Top left: warm pale sandy ochre Persian handmade brick masonry, staggered horizontal bond, thin worn cream lime mortar, small long bricks, subtly varied dusty terracotta and buff hues, natural irregularities and fine stone pores. Top right: warm off-white aged lime plaster, subtle patina, fine grain and small repairs. Bottom left: dark medium walnut wood boards, delicate grain and rubbed edges, four boards horizontal. Bottom right: lightly worn warm gray-beige limestone paving slabs in staggered bond with thin seams. Materials only; avoid text, labels, watermark, objects, stylization or baked sunlight.

This is a normalized record of the generation brief. The complete request also specified 2048 × 2048 and 1024 × 1024 quadrants; the actual returned dimensions above take precedence. These assets are project graphics, not a claim of photographic documentation of Tehran.

## Third-party packages

| Package | License / source | Use |
|---|---|---|
| Three.js 0.180.0 | MIT · https://github.com/mrdoob/three.js | Renderer, geometry, loaders, OrbitControls, SSAO and decoder assets |
| Vite 7.1.12 | MIT · https://github.com/vitejs/vite | Development and static build |
| TypeScript 5.9.3 | Apache-2.0 · https://github.com/microsoft/TypeScript | Type checking |
| @types/three 0.180.0 | MIT · https://github.com/DefinitelyTyped/DefinitelyTyped | Type definitions |
| Vazirmatn via @fontsource/vazirmatn 5.2.6 | SIL Open Font License 1.1 · https://github.com/rastikerdar/vazirmatn | Bundled Persian/Latin font |

The Draco/Basis files are copied from the pinned Three.js package to remove runtime CDN dependence. Their upstream licensing remains applicable. `THIRD_PARTY_NOTICES.md` accompanies them. Inspect the dependency licenses in `node_modules` when redistributing or incorporating more assets.

No Poly Haven or Sketchfab asset is bundled. The previous projects' remote texture behavior was reviewed, but this implementation does not fetch those runtime CDNs.
