# Kaghaz v2 validation

- Blender 4.3.2 is available in the authoring environment. All nine GLB assets were exported from actual mesh objects. Three Cycles CPU renders at 1200 × 820 and 240 samples were produced. The stock camera was corrected after visual inspection found an occluding wall.
- TypeScript and Vite production build pass with `/Kaghaz/v2/` as the public base.
- Automated tests cover Persian search/state/inquiry/import limits; GLB chunk boundaries, internal image URIs, declared WebP, SHA-256, triangle and download budgets, actual metric bounds and semantic parts; independent PBR maps; comparison limits and storage isolation.
- Frozen v1 source is commit `25dc79f755cdd5f71b324f3f1705c67097421453`. The v1 branch is not modified during v2 delivery. Main changes only coordinate multi-version hosting and documentation.
- The managed local preview relay is unavailable. Cloud browser WebGL is disabled, so live WebGL rendering, GPU timing, FPS, collision feel and final appearance on RTX 3060 are not certified by this environment. DOM UI and explicit render fallback are verified on the published site when deployment finishes; record those results below.

Do not interpret the Blender render as a screenshot of the realtime renderer. The browser renderer uses the same asset files but different lights, tone mapping and visibility budgets. These require review on a WebGL2-capable device before a client presentation.

## Published-site UI review

- Both versioned routes and the unchanged root were deployed through the central GitHub Pages workflow. v2 CI and both version builds passed before assembly.
- On the published v2 page, the real Blender fallback image and all three gallery images loaded at 1200 × 820. Gallery tabs changed the image and accessible description.
- Selecting two products opened the comparison table with distinct grammage, dimensions, sales units and order minimums. Persian search using Arabic letter forms and Arabic digits returned the expected three 80 gsm paper products.
- The product detail view displayed specifications plus an explicitly labelled static Blender render when WebGL was unavailable. The personal booth form retained category/identity fields, independent product kind, GLB upload and PDF upload controls. No merchant record or file was sent to a server during this review.
- Two fallback-only UI issues found in review were corrected: the product hint no longer invites rotating a static image; realtime-only light/walk/orbit/capture controls are disabled when WebGL initialization fails. Dismissed editorial content is also hidden from accessibility navigation.
- GLB packaging was rerun against all nine packed models and SHA-256 remained unchanged, verifying idempotent packing.

The live WebGL limitations stated above remain. Form visibility is not an end-to-end certification of every uploaded decoder combination.
