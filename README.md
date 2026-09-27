# 等一尾 · 月隐湾

## 参考视频玩法

先选钓点和鱼饵。轻点“抛竿”会落在中段；按住按钮向上或向下拖动可调远近，左右拖动可调方向，松手即抛。镜头在拖动时保持角色身后视角。近岸等待稍短、小鱼倾向略高；远水等待稍久、大鱼倾向略高；落点不会保证特定鱼种。等鱼靠近后，在短暂的读漂窗口里根据浮漂和鱼线选择稳住、轻提或收紧；不操作会视为继续观望。判断偏了会在水边观察里留下提示，咬稳后仍需及时提竿；鱼口散去后会自动收回空线。搏鱼时留意鱼的蓄力与冲刺：按住线轮收线，冲刺时松手让线以消耗鱼的体力；鱼放缓时从收线区向上划一下抬竿，随后收住距离。桌面也可点“抬竿带鱼”或按 ↑，按空格收线。界面中的竿弯、线形和鱼的位置由鱼距、实际出线长度和受力驱动。成功钓获后可以放进鱼篓，在“鱼篓 · 商店”出售换金币，购买装备升级。旧存档会自动补上金币与装备等级数据。

Three.js r180 H5 prototype. The 3D scene and fight simulation run independently of the SolidJS interface components. For development, run `npm install` then `npm run dev` (Vite). For release, run `npm run build` and publish the generated `build/` directory as the site root. `npm run preview` serves that release build locally. The build includes the models, textures, and audio loaded at runtime. `dist/` contains the editable source; `dist/dist/` is an older build and is not the release directory.

The playfield is designed for portrait screens. On a wide monitor the same portrait playfield is centered at phone-like width; casting gestures scale to the playfield dimensions.

## Implemented loop

Choose one of three water locations and three unlimited baits, cast, read the bite, strike, fight and record/release. Cast state is persisted so reloads neither reroll nor reset a cast. A firm bite has a generous strike window before the fish releases the hook. Later casts can have an empty-hook result.

Nine catches include two named individuals. Discover two clues at the old bridge or deep water. Old Gold then becomes possible at the bridge with grain after rain; Moonwhite becomes possible in deep water with glow insects in clear daylight. Weather rotates every 120 seconds. Each qualifying cast still samples a weighted pool; no guaranteed encounter or near-miss substitution. The existing `moon` weather ID is preserved for save compatibility.

Progress is explicitly device-local, stored under `moonwater-v1`. No account sync or server economy. A maximum of 250 recent catches is retained, with 60 displayed. Current records are calculated over retained catches. Storage errors display a visible warning.

## Files

- `dist/engine.mjs`: data, weather, weighted sampling, clue discovery, idempotent cast settlement.
- `dist/app-final.js`: UI, local storage, audio, journal and fight input.
- `dist/ui/setup.jsx`, `dist/ui/journal.jsx`, `dist/ui/trip-route.jsx`: SolidJS components for fishing setup, journal navigation and the current outing card. The app passes state snapshots to these components; the scene and frame-by-frame fight graphics stay outside SolidJS.
- `dist/reference-loop.mjs`: fish movement, reel payout, line force, rod lifts and landing rules.
- `dist/fishing-rhythm.mjs`: wait and bite cues plus strike timing.
- `dist/scene.js`: Three.js perspective scene, composed overview-to-shoulder camera transition, articulated angler, procedural sand/rock shaping, spring-driven rod, restrained fish silhouettes, splash particles, nine 3D specimen models and specimen viewer.
- `dist/water.js`: layered Gerstner displacement, protected depth refraction, supplied dual normal maps, supplied macro-noise texture, Beer-Lambert absorption/scattering, half-resolution planar reflection, restrained Fresnel/glitter response, shoreline meniscus/foam, twelve short-lived fish/bobber ripples and three local drag-wave patches. The structure adapts ideas from the supplied Raider water shaders to this WebGL scene scale.
- `dist/fishing-motion.js`: cast/approach/nibble/hooked/empty phases, fixed-step Verlet fishing line with gravity, variable spool length, water contact, tension/reel constraints and reusable dynamic tube geometry.
- `dist/style.css`: desktop/mobile presentation.
- `dist/simulator-ui.css`: simulator-style dashboard, action, journal and mobile presentation overrides.
- `dist/portrait-polish.css`: the portrait-first type, color and control system. It uses compact Noto Sans SC and Noto Serif SC WOFF2 subsets under `dist/assets/fonts/` (SIL OFL 1.1). Regenerate them with `tools/subset_ui_fonts.py` when adding Chinese interface text.
- `dist/assets/journal-fish-watercolor.webp`: generated decorative watercolor for the journal and catch panels.
- `assets/legacy/lake.webp`, `assets/legacy/specimens.webp`: previous 2D artwork retained outside the published directory; the current page does not load them.

## Prototype boundaries

The scene and specimens are rendered as true polygonal 3D using WebGL2. Before casting, drag to rotate the overview camera, scroll or use the +/- controls to zoom, and click the water to choose the nearest ecological fishing location. Pressing “准备抛竿” enters a shoulder-level aiming view; drag to adjust the view, tap the water to switch the landing location, then press again to cast. Waiting keeps the same restrained shoulder view. Ambient fish are normally almost invisible, appearing only as occasional low-opacity glints. The persisted catch approaches as a submerged silhouette during the final seconds and becomes readable only during retrieval. Movement vectors drive fish orientation. Empty hooks and objects never receive false fish-arrival cues. Entry, nibbling, bites and retrieval disturb both water displacement and normals. Fish and bobber ripples are analytic expanding waves; drag-to-make-waves uses a local shallow-water height/velocity solver with a short retained wake, not a full-domain fluid simulation. Weather changes exposure, fog, lighting and encounter conditions; it does not simulate a complete day/night cycle. Clues are authored location-based sequences. Decorative silhouettes do not determine catches. Each named fish is persistent as a concept, not a fully simulated animal with tracked coordinates. No currency, trading, upgrades, teams or combat.

Validation: scene construction, all nine model geometries, casting/tension/retrieval states, finite transforms, JavaScript syntax, custom water GLSL compilation/linking with software OpenGL ES, 1,200-frame variable-slack line stability, outcome-dependent cue phases and desktop camera composition by projected screen coordinates were checked. The provided cloud browser still has WebGL disabled. Full rendered visual QA, real-device performance and mobile camera feel remain unverified.

## Next playtest

Check whether players change location or bait after a clue, return to seek either named resident, and feel ordinary catches are visually satisfying. Tune those before adding species or progression systems.
