# 项目架构与维护地图

## 当前技术栈与入口

本仓库当前是 Three.js + SolidJS + Vite 的 H5 游戏项目。`src/index.html` 加载 `src/app-final.js`；它管理存档、输入、界面和音频，并调用 `src/scene.js` 创建 Three.js 场景。Vite 从 `src/` 构建，直接加载的模型、贴图、字体和音频位于 `public/assets/`，输出到忽略 Git 的 `build/`。

`src/` 中的 `three.core.js`、`three.module.js` 和 `vendor/` 是当前渲染链的依赖，暂不能删除。`archive/legacy/` 的旧控制器、旧场景和历史页面不参与活动入口、测试或构建。`assets_pipeline/` 是 Blender 等美术生产源，不能直接当作运行时资产。

## 模块边界

| 类别 | 权威位置 | 职责 |
| --- | --- | --- |
| 内容数据 | `src/data/catalog.mjs` | 钓点、鱼饵、鱼种、装备、鱼讯、出行目标、商店与天气 ID；保存 ID 不可随意修改 |
| 音频资产清单 | `src/data/audio-assets.mjs` | UI 与环境音频到 `public/assets/audio/source/` 的映射 |
| 玩法配置 | `src/config/game-rules.mjs` | 存档键/版本、容量上限、出行竿数、天气与等待/读漂时间 |
| 垂钓状态 | `src/engine.mjs` | 存档创建/迁移、抽样、读漂、结算、追踪与生态变化；旧导出继续兼容 |
| 搏鱼计算 | `src/reference-loop.mjs` | 鱼、线、张力、抬竿与经济结算的纯逻辑 |
| 三维场景 | `src/scene.js`、`src/water.js`、`src/coast.js`、`src/water-surface.js` | 角色、鱼、镜头、海岸、水和渲染反馈 |
| 界面 | `src/app-final.js`、`src/ui/`、`src/*.css` | 状态绑定、交互、SolidJS 组件和画面样式 |
| 发布 | `vite.config.js`、`tools/verify-build.mjs` | 构建、静态资产复制与发布完整性校验 |

依赖方向：数据与配置不导入 DOM 或 Three.js；玩法逻辑读取数据与配置；界面和场景调用玩法逻辑。`app-final.js`、`scene.js` 与 `water.js` 仍较大，后续改动应按职责逐块抽离，不在一次目录迁移中重写交互时序。

## 关键约束

- 存档键保持 `moonwater-v1`，天气 `moon` ID 兼容旧存档；变更字段需先写迁移测试。
- 抛竿结果在创建时确定，结算只处理一次；刷新后不得重新抽鱼或重复奖励。
- 直接加载的资源路径以 `./assets/` 为页面相对前缀。CSS 使用 `/assets/`，Vite 会按相对发布基址重写到 `build/bundles/` 对应的 `../assets/`。
- `npm test` 运行 Node 单元与结构测试；`npm run build` 构建并检查关键模型、贴图、字体和所有声明的音频。渲染质量、输入手感和真机性能仍需浏览器/设备验收。
- 本仓库没有 Unity 工程。用户指定的 Unity Test Framework 与当前技术栈不一致；现存 Node 测试不可当作 Unity 测试。

## 产品与技术待决事项

`HANDOFF.md` 反对金币售卖升级循环，现有可运行逻辑、`README.md` 历史说明和测试却包含该循环。此分歧没有在本轮结构整理中擅自改玩法。后续产品决策应先更新 [垂钓流程规格](design/fishing-loop-spec.md)，再改实现与测试。

当前自动验证覆盖逻辑与资源完整性；没有完成浏览器实际渲染、竖屏交互和性能验收。美术类要求以 `HANDOFF.md` 的截图/录屏清单作为待执行验证项。
