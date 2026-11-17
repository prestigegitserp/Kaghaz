# Validation record — Kaghaz 1.0.0

Date: 2026-11-17. Runtime used for local validation: Node.js 24.22.1, npm 11.9.0. This record separates executed checks from implementation claims and target-device work that remains.

## Executed successfully

- `npm ci` / dependency installation completed with the pinned dependency inputs and generated lockfile.
- `npm run build`: preparation of local decoders, TypeScript strict checking, and Vite production build passed.
- `npm test`: **10 tests passed, 0 failed**.
- `node scripts/measure-build.mjs`: measured build artifact sizes without starting a browser.
- Private site source push, archive-backed version save and publication succeeded. The final publication status and source are tracked through the hosting service; the live origin is documented in the README.

## What the tests cover

1. Persian/Arabic letters, Persian/Arabic digits, and multi-token search; category and shop filtering.
2. Order quantity normalization, invalid values, bounds and minimums.
3. Workspace import allow-listing, attachment isolation, ID deduplication and HTML escaping.
4. Personal-booth limits and rejection of orphan products.
5. Unsent inquiry wording and separate units; no invented cross-unit price sum.
6. Unique product IDs, existing merchants and explicit order units.
7. Metric bay placement and aisle spacing.
8. Invalid/truncated GLB headers and external URI rejection.
9. GLB file, node and triangle budgets.
10. Triangle accounting for shared mesh references across multiple nodes.

These are behavior/contract checks. They do not claim to prove the subjective realism of a model or that a WebGL scene successfully rendered.

## Build-size snapshot

One completed production build produced the following rounded measurements. Run the measurement script for exact current filenames and bytes; content hashes change with source edits.

| Asset group | Bytes / size | Interpretation |
|---|---:|---|
| Application UI JavaScript | 62,415 raw / 20,538 gzip | DOM shell, catalog, creator, inquiry |
| Three.js chunk | 535,750 raw / 136,001 gzip | Main renderer library |
| World chunk | 56,469 raw / 18,350 gzip | Scene, navigation and postprocessing |
| Batch / material / shop chunk | 22,418 raw / 5,763 gzip | Shared scene construction |
| GLB loader chunk | 135,374 raw / 46,948 gzip | Import and decoders' loader logic; binary decoders are separate |
| Product studio chunk | 2,456 raw / 1,250 gzip | Separate product viewer |
| All JavaScript chunks | 228,850 gzip bytes | Sum of emitted scripts, not a measured first-visit waterfall |
| Four WebP material textures | 248,192 bytes | 512² material images |
| Complete static output | about 2.92 MB, 46 files | Includes font fallbacks and on-demand decoder files |

CSS, fonts, decoder fetches, HTTP compression and browser caching affect actual transfer. This is not a benchmark of load time. The figures were recorded before final documentation-only source changes.

## Browser QA blocker

`sites-preview start` and `sites-preview status` both returned `preview relay unavailable: No such file or directory`. The managed preview infrastructure was unavailable. No replacement browser/server path or sandbox/network bypass was used.

The published private origin was opened through the supplied cloud browser and showed the expected owner sign-in gate. The attempt to continue sign-in was denied by automatic approval review at the OpenAI authentication origin. Authentication was not bypassed, access was not made public, and no credentials were requested or exposed.

Consequently, the following remain **unverified**:

- Visual appearance of the rendered 3D market, light balance, texture seams and shop/sign legibility.
- Browser end-to-end camera travel, occlusion, collisions, picking, map controls and screenshot output.
- Mobile layout, simultaneous touch motion/look and actual GPU performance.
- Decoding and rendering a real user GLB with Draco, Meshopt or KTX2.
- Browser persistence/recovery of real PDF and GLB files, complete creator workflow and inquiry export.
- Accessibility behavior in actual screen readers and older browser fallback behavior.

## Performance implementation versus measurement

Implemented: instanced repeated geometry inside spatial shop cells; no React state in the frame loop; demand rendering; quality-based DPR caps; a single static shadow-casting directional light; optional SSAO in the high preset; hidden far inventory; no persistent rendering while the page is hidden; local fonts, textures and model decoder files.

Not implemented: fully streamed sectors with asset eviction, GPU occlusion queries, baked scan lightmaps, CDN/LOD ingestion backend, user accounts, shared merchant storage, real order submission or load-tested concurrent users.

The F3 overlay reports draw calls, triangles, DPR, preset and CPU submission duration for an active frame. It is **not GPU duration and not measured FPS**. The high preset may need further tuning on target hardware. See the Persian acceptance guide for the required actual-device checks.

## Practical release classification

Executable v1 foundation / demonstration, with passing build and logic tests and a successfully deployed private artifact. It must not be presented as an audited production multi-vendor marketplace, a verified photoreal reconstruction, or a certified performance benchmark.
