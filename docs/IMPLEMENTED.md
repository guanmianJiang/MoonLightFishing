# 已实现功能总清单

## 记录规则

以当前 Git 仓库源码、测试和构建结果登记。每次新增或修改功能，同步更新该功能的目标、等级/优先级、依赖、测试要点和完成版本。`2026.09-structure` 是本次迁移整理基线标识，表示源码、自动测试与构建已恢复；不代表完成真实设备视觉验收。

| 功能名称 | 目标 | 等级/优先级 | 依赖模块 | 测试要点 | 完成版本 |
| --- | --- | --- | --- | --- | --- |
| 项目源码与资产分层 | 让编辑源码、运行资产、美术生产源、历史文件和构建产物各有固定目录 | P0 | `src/`、`public/assets/`、`assets_pipeline/`、`archive/legacy/`、`vite.config.js` | `npm test`、`npm run build`；活动入口不引用旧目录，构建资源齐全 | `2026.09-structure` |
| 内容目录与参数配置 | 集中管理钓点、鱼种、装备、天气、鱼讯、商店、容量和关键时长，保持存档 ID 兼容 | P0 | `src/data/catalog.mjs`、`src/config/game-rules.mjs`、`src/engine.mjs`、`src/reference-loop.mjs` | ID 唯一、重量边界、旧 `moon` 天气 ID、出行时间边界、存档版本与键；现有逻辑回归 | `2026.09-structure` |
| 选点、抛竿与读漂结算 | 根据钓点、鱼饵、天气和水域规则生成抛竿结果，并支持读漂、线索与幂等结算 | P0 | `src/engine.mjs`、`src/cast-target.mjs`、`src/fishing-rhythm.mjs`、`src/data/catalog.mjs` | 正常/失误读漂、早期宽容、存档迁移、重复结算和空钩；`tests/fishing-decisions.test.mjs` 等 | 原源码恢复；`2026.09-structure` 验证 |
| 搏鱼、钓线与钓获处理 | 让收线、放线、抬竿、鱼体运动与钓获后处理形成同一状态链 | P0 | `src/reference-loop.mjs`、`src/fishing-motion.js`、`src/engine.mjs` | 固定步长、张力与松线、抬竿窗口、胜负、重复售卖边界；`tests/reference-loop.test.mjs` 等 | 原源码恢复；`2026.09-structure` 验证 |
| 本地进度与经济数据 | 在设备本地保存进度，兼容旧存档并维护当前鱼篓、金币与装备数据 | P1 | `src/app-final.js`、`src/engine.mjs`、`src/reference-loop.mjs`、`src/config/game-rules.mjs` | 旧存档迁移、容量边界、重复处理与保存失败提示；浏览器存储异常仍需实机复核 | 原源码恢复；`2026.09-structure` 验证 |
| 三维海岸、水面与镜头 | 提供角色、鱼、海岸、水面反馈和各阶段构图 | P0 | `src/scene.js`、`src/water.js`、`src/coast.js`、`src/camera-intro.js`、`src/coastal-motion.js`、`public/assets/` | 开场镜头连续与归位、渡船竖屏可见、岸边水高匹配地形、水流/资源测试；视觉质量另验 | 原源码恢复；`2026.09-structure` 修复并验证 |
| 界面与音频资源 | 提供选择、手记、结果弹窗、声音反馈和当前页面交互 | P1 | `src/app-final.js`、`src/ui/`、`src/data/audio-assets.mjs`、`public/assets/` | 活动入口结果弹窗测试、资源路径存在与构建检查；触控手感另验 | 原源码恢复；`2026.09-structure` 整理并验证 |
| 发布构建与资源校验 | 从 Git 克隆后可安装依赖、测试并产出完整静态站点 | P0 | `package.json`、`package-lock.json`、`vite.config.js`、`tools/verify-build.mjs` | `npm ci`、`npm test`、`npm run build`、`npm audit --audit-level=moderate`；检查 JS/CSS、模型、贴图、字体和全部声明音频 | `2026.09-structure` |

## 本轮自动验证

- `npm test`：169 项通过、0 项失败。测试运行环境是 Node `node:test`，不是 Unity Test Framework。
- `npm run build`：通过，`build/` 中的入口、分包和关键资源已校验。Three.js、SolidJS 与应用分包，没有超过构建工具默认大小告警的包。
- Vite 开发依赖已更新到 6.4.3；`npm ci` 可复现安装，`npm audit --audit-level=moderate` 报告 0 个漏洞。
- 美术和渲染部分仅完成数学、几何、资源及代码结构验证；浏览器实画、移动设备与性能尚未验收。

## 已知不一致与待决项

1. `HANDOFF.md` 反对鱼篓售卖升级循环；当前代码和测试包含该循环。产品方向待决定，本轮未擅自移除。
2. 用户要求 Unity Test Framework；仓库目前是 H5/Three.js 工程，没有 Unity 项目。现有 Node 测试不能满足 Unity 测试要求。后续若转 Unity，需要建立测试程序集并迁移逻辑测试。
3. `src/app-final.js`、`src/scene.js`、`src/water.js` 仍是较大的模块。后续按对应 spec 逐项拆分，并确保每一步有行为测试和视觉回归。
