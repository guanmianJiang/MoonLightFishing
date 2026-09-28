# 已实现功能总清单

## 记录规则

以当前 Git 仓库源码、测试和构建结果登记。每次新增或修改功能，同步更新该功能的目标、等级/优先级、依赖、测试要点和完成版本。`2026.09-structure` 是本次迁移整理基线标识，表示源码、自动测试与构建已恢复；不代表完成真实设备视觉验收。

| 功能名称 | 目标 | 等级/优先级 | 依赖模块 | 测试要点 | 完成版本 |
| --- | --- | --- | --- | --- | --- |
| 项目源码与资产分层 | 让编辑源码、运行资产、美术生产源、历史文件和构建产物各有固定目录 | P0 | `src/`、`public/assets/`、`assets_pipeline/`、`archive/legacy/`、`vite.config.js` | `npm test`、`npm run build`；活动入口不引用旧目录，构建资源齐全 | `2026.09-structure` |
| 内容目录与参数配置 | 集中管理钓点、鱼种、装备、天气、鱼讯、商店、容量和关键时长，保持存档 ID 兼容 | P0 | `src/data/catalog.mjs`、`src/config/game-rules.mjs`、`src/engine.mjs`、`src/reference-loop.mjs` | ID 唯一、重量边界、旧 `moon` 天气 ID、出行时间边界、存档版本与键；现有逻辑回归 | `2026.09-structure` |
| 选点、抛竿与读漂结算 | 根据钓点、鱼饵、天气和水域规则生成抛竿结果，并支持读漂、线索与幂等结算 | P0 | `src/engine.mjs`、`src/cast-target.mjs`、`src/fishing-rhythm.mjs`、`src/data/catalog.mjs` | 正常/失误读漂、早期宽容、存档迁移、重复结算和空钩；`tests/fishing-decisions.test.mjs` 等 | 原源码恢复；`2026.09-structure` 验证 |
| 两段式抛竿与竖屏构图 | 俯瞰看三个水域范围，近景准备/瞄准看当前范围；轻薄边缘水晕保留原水色，近景轻点或短拖范围内水面进入瞄准，拖动调整落点并得到短促水纹反馈；双指仍缩放，抛竿需单独确认 | P0 | `src/app-final.js`、`src/cast-target.mjs`、`src/camera-interaction.mjs`、`src/scene.js`、`src/index.html`、`src/*.css` | 范围与触点同源、轻点/短拖阈值和双指边界、范围外与已有抛竿不误触、取消、镜头切换；`tests/cast-target.test.mjs`、`tests/camera-interaction.test.mjs`；390×844 浏览器实画 | `2026.09-cast-water-response` |
| 镜头触控响应与阶段转场 | 让瞄准确认等待镜头、取消恢复原视角，岸上触点保留原落点，鱼讯观察与提竿有短促响应，搏鱼隐藏遮挡性控件，出水镜头连续过渡 | P0 | `src/camera-interaction.mjs`、`src/scene.js`、`src/app-final.js`、`src/portrait-polish.css` | 镜头意图、就位边界、9:16 投影和短促响应；`tests/camera-interaction.test.mjs`；320×568、390×844、430×932 浏览器竖屏模拟，含瞄准、等待、读漂与搏鱼 | `2026.09-camera-interaction` |
| 搏鱼右肩侧向镜头 | 收线时让角色、鱼、浮漂与鱼线同框；远鱼从角色右肩观察，鱼靠近码头时连续移向鱼线侧面 | P0 | `src/fishing-camera.mjs`、`src/scene.js` | 各钓点与鱼距的 9:16 投影、镜头连续性、横屏兼容、真实搏鱼截图；`tests/fishing-camera.test.mjs`；近鱼真机画面待验 | `2026.09-fight-side-camera` |
| 搏鱼镜头手动观察 | 搏鱼追踪镜头支持鼠标拖动与滚轮、触控单指拖动与双指缩放，也可用右侧按钮切顶视、缩放和归位；镜头调整不触发收线 | P0 | `src/fishing-camera.mjs`、`src/scene.js`、`src/app-final.js`、`src/index.html`、`src/portrait-polish.css` | 环绕边界、异常输入和水平距离保持；`tests/fishing-camera.test.mjs`；390×844 浏览器搏鱼拖动、缩放及按钮布局；真实多点触控和低端手机帧率待验 | `2026.09-fight-camera-controls` |
| 抛投、鱼讯与出水镜头节奏 | 抛投由蓄力到追随浮漂后回待机；鱼讯特写机位与视野同步退回；鱼冲刺让出画面，搏鱼结束后再移向鱼体 | P0 | `src/fishing-camera.mjs`、`src/scene.js` | 抛投曲线边界、异常时间、冲刺输入、出水停留与过渡；`tests/fishing-camera.test.mjs`；390×844 抛投和等待实画，鱼体出水真机待验 | `2026.09-camera-choreography` |
| 瞄准转场与固定鲨鱼巡游 | 点抛竿从俯瞰平顺进入近景，仍可手动回俯瞰选点；鲨鱼不再随落点变化而挪动 | P0 | `src/app-final.js`、`src/scene.js`、`src/camera-interaction.mjs`、`src/marine-motion.mjs`、`src/portrait-polish.css` | 视角进入与确认分支、转场缓动与中途切换、固定世界路线与水下深度；`tests/camera-interaction.test.mjs`、`tests/marine-motion.test.mjs`；320×568、390×844、430×932 浏览器模拟 | `2026.09-smooth-aim-camera` |
| 旧版读漂超时兼容 | 保留历史读漂逻辑供旧格式和测试使用；未决存档转入自然鱼口 | P2 | `src/engine.mjs`、`src/bite-guidance.mjs` | 旧版截止时间、空钩、无宽容和连胜奖励、重复处理；`tests/fishing-decisions.test.mjs` | `2026.09-core-cast` |
| 自然鱼口与单次提竿 | 以鱼影、漂相、水纹和张力替代限时三选一；咬实后用一个触控按钮或点按浮漂提竿 | P0 | `src/engine.mjs`、`src/fishing-motion.js`、`src/scene.js`、`src/app-final.js`、`src/index.html` | 自动试探到咬实、宽松提竿窗口、超时幂等、旧未决抛竿迁移、竖屏读漂/提竿实画；`tests/natural-bite.test.mjs` | `2026.09-natural-bite` |
| 连续垂钓节奏与空钩回流 | 压缩没有有效信息的等待；空钩自动结算并直接回到临水准备态，钓获处理后保持近景 | P0 | `src/config/game-rules.mjs`、`src/engine.mjs`、`src/fishing-motion.js`、`src/app-final.js`、`src/index.html` | 新抛竿时长边界、空钩/已处理结果幂等、最后一竿摘要、钓获明确选择、旧无鱼读漂恢复；`tests/fishing-session.test.mjs`、`tests/result-dialog.test.mjs`；竖屏浏览器核对 | `2026.09-session-flow` |
| 失手鱼讯追踪与宽松提竿 | 错过鱼口或搏鱼脱钩后留下一竿可追的同种鱼线索，让再次抛竿有目标；取消逐轮收紧的提竿时限 | P0 | `src/water-trail.mjs`、`src/engine.mjs`、`src/app-final.js`、`src/config/game-rules.mjs` | 同钓点同鱼饵回游机会、等待与提竿窗口、脱钩/错过、换饵消耗、稀有鱼门槛、旧存档与幂等；`tests/water-trail.test.mjs`、`tests/fishing-decisions.test.mjs` | `2026.09-water-trail` |
| 水域推进与落点难度引导 | 已有钓获持续积累探索进度，按近岸→栈桥→深水引导并可直接切换；近水提竿更宽松、远水偏向较强目标 | P0 | `src/progression-guide.mjs`、`src/engine.mjs`、`src/ui/setup.jsx`、`src/ui/trip-route.jsx`、`src/app-final.js`、`src/portrait-polish.css` | 旧存档回算、近岸上限和深水门槛、空钩/重复结算、指引动作、落点鱼种倾向与提竿窗口；`tests/progression-guide.test.mjs`；竖屏准备态实画和引导按钮 | `2026.09-water-progression` |
| 钓获结果分层处理 | 让普通重复钓获可以一次点按处理，把完整取舍留给首次、特殊与追踪钓获 | P0 | `src/catch-presentation.mjs`、`src/app-final.js`、`src/index.html`、`src/portrait-polish.css` | 建议操作、容量和沉水物边界、默认展开及折叠控件状态；`tests/catch-presentation.test.mjs`、`tests/catch-result-ui.test.mjs`；结果页实画待补 | `2026.09-catch-flow` |
| 钓获结果页单次演出 | 搏鱼胜利后只播放一次提鱼演出，结果页等待选择期间停止收线和重复音效；刷新恢复静音展示 | P0 | `src/reel-transition.mjs`、`src/app-final.js`、`src/engine.mjs` | 演出阶段门槛、重复触发、振动/音效次数、刷新恢复；`tests/result-dialog.test.mjs` | `2026.09-result-once` |
| 搏鱼、钓线与钓获处理 | 让收线、放线、抬竿、鱼体运动与钓获后处理形成同一状态链 | P0 | `src/reference-loop.mjs`、`src/fishing-motion.js`、`src/engine.mjs` | 固定步长、张力与松线、抬竿窗口、胜负、重复售卖边界；`tests/reference-loop.test.mjs` 等 | 原源码恢复；`2026.09-structure` 验证 |
| 角色、鱼竿、鱼线与鱼饵受力反馈 | 抛投回弹、咬口冲击、搏鱼让线和举竿同步传到角色与线形；鱼的短促挣扎驱动鱼体横摆、浮漂、线、竿与持竿动作；搏鱼时鱼饵和实体钩共同挂在鱼嘴锚点，浮漂投影跟随鱼嘴 | P0 | `src/angler-feedback.mjs`、`src/fight-performance.mjs`、`src/cast-flight.mjs`、`src/bait-motion.mjs`、`src/rod-grip.mjs`、`src/two-bone-ik.mjs`、`src/fish-attachment.mjs`、`src/fishing-motion.js`、`src/fishing-art.js`、`src/scene.js` | 鱼嘴/实体钩/鱼饵三维重合、浮漂位于鱼嘴上方而非背部、鱼饵浮漂与鱼嘴间无重复、异步资产到达、绷线脉冲与松线隔离、固定臂长及远近抛；`tests/fish-attachment.test.mjs`、`tests/fight-performance.test.mjs` 等；竖屏浏览器抽查 | `2026.09-performance-pass-4` |
| 咬钩与搏鱼鱼体受力姿态 | 同一实体鱼连续经过试饵、咬钩和搏鱼；鱼嘴沿斜向游近饵钩，高度随水平距离变化，收线先更新鱼体姿态再对齐浮漂和鱼线；调整期、冲刺和横向闪躲有短促横摆、潜浮和尾拍 | P0 | `src/bait-engagement.mjs`、`src/fight-fish-motion.mjs`、`src/fight-performance.mjs`、`src/fish-attachment.mjs`、`src/scene.js` | 斜向接近与末段高度边界、咬钩前后连续、鱼嘴对钩、搏鱼入场、左右游向、有限转向、挣扎横摆/松线隔离；`tests/bait-engagement.test.mjs`、`tests/fight-fish-motion.test.mjs`、`tests/fight-performance.test.mjs`、`tests/fish-attachment.test.mjs`；竖屏浏览器实画 | `2026.09-fish-load-pose-4` |
| 鱼嘴与鱼饵资产锚点标准 | 七种可钓生物的 GLB 显式导出鱼嘴锚点，三种饵导出钩尖锚点；游戏内鱼饵在浮漂与鱼嘴实体钩之间复用同一模型，延迟加载也服从当前挂载状态 | P0 | `tools/generate_specimens.py`、`tools/generate_fishing_details.py`、`src/fish-attachment.mjs`、`src/fishing-art.js`、`public/assets/models/` | 目录驱动检查锚点、朝向、尺寸、面数；鱼饵往返挂载后钩尖世界误差小于 1 毫米、浮漂不留复制体；`tests/fishing-assets.test.mjs`、`tests/fish-attachment.test.mjs`；竖屏比例与浏览器资源错误检查 | `2026.09-asset-anchors-2` |
| 上钩调整期与触控抬竿边界 | 避免刚进入搏鱼界面就因外游或硬收迅速失败；先收紧鱼线、读竿弯，上划只在可抬竿时转换动作 | P0 | `src/reference-loop.mjs`、`src/fight-guidance.mjs`、`src/app-final.js` | 初段鱼距与阶段转换、抬竿禁用、无效上划保持收线、旧进行中搏鱼不重启、无操作仍失鱼、重鱼硬收仍断线、帧率一致；`tests/reference-loop.test.mjs`、`tests/fight-guidance.test.mjs`、`tests/fight-rig.test.mjs`；390×844 浏览器实画 | `2026.09-fight-opening` |
| 抬竿收益与操作反馈 | 把抬竿明确为鱼回气时短拉近距离、落竿后收线守住；无效时机不执行并显示实际拉近米数 | P0 | `src/reference-loop.mjs`、`src/fight-guidance.mjs`、`src/app-final.js`、`src/index.html`、`src/style.css` | 冲刺/蓄力/外游/松线/收线中不消耗状态，成功后鱼距变化、实际米数反馈；`tests/reference-loop.test.mjs`、`tests/fight-guidance.test.mjs`；搏鱼画面待真机复核 | `2026.09-lift-feedback` |
| 单区收线与上划抬竿 | 用同一触控区完成按住收线、上划短拉、滑回收线、松手让线，撤掉独立抬竿键；仅有效窗口可上划 | P0 | `src/reel-gesture.mjs`、`src/fight-guidance.mjs`、`src/app-final.js`、`src/index.html`、`src/style.css`、`src/fishing-core.css`、`src/casual-ui.css`、`src/ui-calm.css`、`src/simulator-ui.css` | 上划阈值、无效窗口、单次触发、滑回继续、取消/失焦释放、单按钮标记与触控区样式；`tests/reel-gesture.test.mjs`、`tests/fight-guidance.test.mjs`；真机滑动手感待验 | `2026.09-one-gesture-fight` |
| 鱼种搏鱼习性与技巧纪录 | 让鱼的预兆、冲刺、贴底和回气产生不同操作策略；记录每种鱼的最佳让线与抬竿表现 | P0 | `src/fish-behavior.mjs`、`src/reference-loop.mjs`、`src/fight-guidance.mjs`、`src/app-final.js`、`src/engine.mjs` | 双冲预兆、贴底误抬、同重鱼差异、合理操作可钓获、旧存档与异常纪录、评级边界；`tests/fish-behavior.test.mjs` | `2026.09-fish-behavior` |
| 本地进度与经济数据 | 在设备本地保存进度，兼容旧存档并维护当前鱼篓、金币与装备数据 | P1 | `src/app-final.js`、`src/engine.mjs`、`src/reference-loop.mjs`、`src/config/game-rules.mjs` | 旧存档迁移、容量边界、重复处理与保存失败提示；浏览器存储异常仍需实机复核 | 原源码恢复；`2026.09-structure` 验证 |
| 三维海岸、水面与镜头 | 提供角色、鱼、海岸、水面反馈和各阶段构图 | P0 | `src/scene.js`、`src/water.js`、`src/coast.js`、`src/camera-intro.js`、`src/coastal-motion.js`、`public/assets/` | 开场镜头连续与归位、渡船竖屏可见、岸边水高匹配地形、水流/资源测试；视觉质量另验 | 原源码恢复；`2026.09-structure` 修复并验证 |
| 界面与音频资源 | 提供选择、手记、结果弹窗、声音反馈和当前页面交互 | P1 | `src/app-final.js`、`src/ui/`、`src/data/audio-assets.mjs`、`public/assets/` | 活动入口结果弹窗测试、资源路径存在与构建检查；触控手感另验 | 原源码恢复；`2026.09-structure` 整理并验证 |
| 发布构建与资源校验 | 从 Git 克隆后可安装依赖、测试并产出完整静态站点 | P0 | `package.json`、`package-lock.json`、`vite.config.js`、`tools/verify-build.mjs` | `npm ci`、`npm test`、`npm run build`、`npm audit --audit-level=moderate`；检查 JS/CSS、模型、贴图、字体和全部声明音频 | `2026.09-structure` |
| Windows 原生游戏启动器 | 双击 `月隐湾启动器.exe` 打开原生窗口并自动启动游戏；启动反馈即时可见，停止后再启动会自动打开浏览器，支持手动打开与退出 | P0 | `月隐湾启动器.exe`、`tools/launcher.cs`、`tools/build-launcher.ps1`、`启动游戏.cmd`、`src/index.html` | 分段/彩色 Vite 输出解析、动态端口、旧进程输出隔离、Node 查找回退、浏览器启动与进程清理；`tests/launcher-native.test.mjs`；Windows 原生窗口启动/停止/再启动实测 | `2026.09-native-launcher-browser-fix` |

## 本轮自动验证

- 针对收线时钩点看似落在鱼背、试饵鱼垂直上浮的问题，鱼嘴现在沿空间斜向路径靠近饵钩，高度随剩余水平距离同步收敛；搏鱼每帧先求鱼体姿态与真实鱼嘴，再将浮漂移到鱼嘴上方后更新主线和子线。`npm test` 270 项、`npm run build` 和 `git diff --check` 通过。正式构建的竖屏浏览器完成抛竿、咬钩、提竿、搏鱼初段及俯视抽查；当前水下画面未提供足够像素核对口缘细节，持续收放线与低端手机帧率仍需实机验收。
- `npm test`：270 项通过、0 项失败。测试运行环境是 Node `node:test`。
- `npm run build`：通过，`build/` 中的入口、分包和关键资源已校验。Three.js、SolidJS 与应用分包，没有超过构建工具默认大小告警的包。
- 本轮单区手势在独立本地存档中进入实际搏鱼，确认界面仅有一个收线触控区；实画发现桌面模拟容器仍按旧两列排版，已改为单列。浏览器复核布局计算为单列、触控区 `touch-action: none`。实际滑动连续动作和真实手机触感仍待实机试玩。
- Vite 开发依赖已更新到 6.4.3；`npm ci` 可复现安装，`npm audit --audit-level=moderate` 报告 0 个漏洞。
- 整体美术和渲染仍主要依赖数学、几何、资源及代码结构验证；尚未完成全场景浏览器实画、真实移动设备与性能验收。
- 本次在 390×844 浏览器画幅核对准备、瞄准、远处水面选点、沿水面双向拖动、俯瞰切换与取消；在 320×568 核对选点构图和底部按钮。快速确认抛投和等待镜头曾在此前画幅核对。真实手机触控、低端设备帧率及整段搏鱼视觉仍待验收。
- 本轮范围显示在 390×844 实画核对三个俯瞰区域、近景当前范围及独立落点；320×568 实画核对边界、人物、底部控件和范围外触点收束。范围使用初始化后复用的六个轻量网格，真实低端设备上的水面混合与帧率仍需实机检查。
- 针对近景准备态漏显示范围的反馈，在用户窗口近似画幅和 390×844 竖屏实画核对：不进入瞄准也能看到当前区域，俯瞰/近景切换保持可见；有未完成抛竿时范围仍隐藏。准备态与瞄准态的显示规则由 `tests/camera-interaction.test.mjs` 覆盖。
- 本次在 390×844 竖屏实画确认：范围中心恢复原水色、近景范围内按下并拖动可一次进入瞄准和移动光圈，选点水纹及扩散环可见；取消后仍剩 3 竿。范围外点击留在准备态，小屏准备态拖动范围内不再把镜头带离人物。真实手机的水纹质感和触感仍需实机试玩。
- 本地服务入口已在浏览器打开并确认三维场景及操作控件可见；直接打开源码文件的提示由自动测试验证。Windows 双击脚本仍需在用户桌面环境手动复核。
- 针对竖屏反馈重新检查瞄准视角：点抛竿进入近景、手动回俯瞰、远水落点保留、取消归位及转场中间帧均在浏览器完成；鲨鱼世界路线由纯逻辑测试验证，真实手机上的视觉深度仍待实机核对。
- 本轮在 390×844 浏览器画幅确认试探期没有答题面板、咬实时只出现提竿按钮，点按后直接进入搏鱼；鱼线、竿弯和水面同屏可见，搏鱼顶部提示对比度已核对。鱼种行为和旧存档迁移由纯逻辑测试验证，真实手机上的触控命中区与触感仍待实机试玩。
- 连续垂钓这一轮在 390×844 浏览器画幅核对空钩回流：没有空结果弹窗，竿数只减少一次，准备态重新显示“选落点”，近景构图可继续瞄准。收获后的近景回流由界面状态测试覆盖；真实手机上的完整连续多竿手感仍待试玩。
- 钓获处理这轮的展开逻辑、触控按钮和隐藏操作由单元测试验证，构建通过。实画检查遇到连续空钩，尚未在浏览器捕获钓获结果窗；真实手机上的结果页高度和操作手感仍待复核。
- 失手鱼讯追踪通过错过鱼口、搏鱼脱钩、下一竿同条件回游及失败、换饵消耗、稀有鱼门槛和旧存档测试验证；提竿窗口新旧存档边界已核对。390×844 浏览器画幅实画确认错过鱼口后提示出现、跨轮次保留，并在下一轮近景准备态可见；追踪再次抛竿的完整视觉节奏与真机手感仍待试玩。
- 本轮在 390×844 浏览器画幅核对瞄准握竿、释放后的浮漂/鱼线、咬口竿弯、进入搏鱼的初始受力和空线回收。实画发现并修正空线回收时浮漂旁的线圈；复查时线从竿尖顺畅连到回收中的浮漂。长时间搏鱼中反复收放线与低端真机帧率仍待实机验收；本轮未增加独立绘制对象或后处理通道。
- 本轮表现迭代在约 546×697 的浏览器竖向画幅查看准备、瞄准、浮漂落水与鱼口画面：角色、竿、浮漂和鱼线同框，鱼口竿弯与水纹可辨。新增的距离力度、鱼线脉冲和松线边界由单测验证；浏览器未捕获到持续搏鱼过程，故不将长时间收放线手感或低端真机性能记作已验收。表现层复用现有竿/鱼线几何及水面事件，没有增加 draw call。
- 本轮持竿与挂钩迭代在独立本地存档、约 480×720 的竖向游戏区域查看准备、确认抛投、入水、提竿和搏鱼初段：竿柄随角色握手点，浮漂与鱼线同框，没有观察到明显手臂拉伸。鱼体多在水下，截图不足以证明鱼嘴细节；三维鱼嘴/实体钩重合、固定臂长和双手握点由几何测试验证。持续搏鱼、真实手机触控与低端设备帧率仍待实机验收。
- 本轮量化旧版上钩后的无输入失鱼约为 5–6 秒，重鱼持续硬收约 4 秒断线。现增加约 2.4 秒的上钩调整期并缓和常态外游力，测试覆盖首段鱼距、后续鱼种状态、旧存档、胜负边界及无效上划不抬竿；390×844 实画确认“先收紧鱼线”提示、抬竿暂不可点及竿线同屏。持续按住、松手、再抬竿的完整真机手感仍待试玩。
- 按玩家三张截图修正试饵鱼的半透明暗色替身、鱼讯切换时的位移/旋转跳变和搏鱼左右朝向。现在鱼接近时即显示实体模型并写入水下深度，同一模型延续到搏鱼；游动偏移与对钩系数跨状态连续，搏鱼入场位置插值、转头限速，横向朝向跟随实际速度。`npm test` 256 项和 `npm run build` 通过；390×844 近景看到鱼体完整材质、咬实后提竿及搏鱼初段。鱼嘴像素级贴合和不同鱼种长时间收放线仍需真机近景验收。
- 针对收线截图修正鱼饵留在浮漂下而实体钩跟鱼嘴走的分离：同一鱼饵 GLB 在搏鱼时挂到嘴部实体钩、原浮漂短子线隐藏，异步载入也按当前挂载状态安放；浮漂配重珠缩小并压暗，避免被误看成第二颗饵。鱼的横摆、潜浮、尾拍与受力冲击共用挣扎节拍，松线仍可见鱼挣扎但不把冲击传给竿线。`npm test` 260 项、`npm run build` 和 `git diff --check` 通过；390×844 浏览器检查咬钩至搏鱼初段，近景鱼嘴像素级可读性与持续收放线手感仍待真机验收。
- 本轮重新导出七种可钓生物和三种鱼饵：GLB 均有唯一、无网格的嘴部或钩尖锚点，Blender 源文件、生成脚本和资产清单同步更新；按目录驱动的测试会让后续新增鱼种缺锚点时直接失败。三种游戏内鱼饵统一缩至原来的 72%，饵钩以真实钩尖对齐浮漂钩点。`npm test` 242 项通过，`npm run build` 通过；Blender 预览核对了材质颜色和形体，390×844 浏览器确认麦粒饵比浮漂小且无资源加载错误。其他鱼饵在真实手机中的清晰度和低端设备帧率仍待实机验收；锚点本身不增加绘制对象。
- 本轮搏鱼镜头输入在 390×844 浏览器实画核对：搏鱼按钮排在底部操作区上方，鼠标拖动能改变侧向观察，拉近按钮能改变景别；`tests/fishing-camera.test.mjs` 与 `tests/camera-interaction.test.mjs` 共 17 项通过，构建通过。真实手机双指手势和低端设备帧率仍待实机验收。
- 本轮将启动器改为原生 exe：双击 `月隐湾启动器.exe` 直接开窗启动，不再经过 cmd/PS1；按钮由「启动/重启/停止/打开/退出」精简为「启动/停止」切换 + 打开游戏 + 退出；关闭窗口用 taskkill `/T` 清理整棵进程树。Windows 上实际启动 exe，确认 vite 服务在 5173 返回 200、优雅关闭后窗口退出且其子进程被清理。`tests/launcher-native.test.mjs` 覆盖入口无 cmd 链、控件覆盖、无“重启”、生命周期与整树清理；完整 `npm test` 257 项全部通过。

## 已知不一致与待决项

1. `HANDOFF.md` 反对鱼篓售卖升级循环；当前代码和测试包含该循环。产品方向待决定，本轮未擅自移除。
2. 技术栈已确认：H5/Three.js 工程，单元测试使用 Node `node:test`，不使用 Unity（历史提到的 Unity Test Framework 要求已作废）。
3. `src/app-final.js`、`src/scene.js`、`src/water.js` 仍是较大的模块。后续按对应 spec 逐项拆分，并确保每一步有行为测试和视觉回归。
