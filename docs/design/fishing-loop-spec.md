# 垂钓流程与存档规格

> 状态：源码已恢复，逻辑测试已运行；浏览器交互仍待验收。依据 `src/engine.mjs`、`src/data/catalog.mjs`、`src/config/game-rules.mjs` 和配套测试维护。

## 目标与范围

玩家选择钓点和鱼饵，抛竿、观察咬口、提竿、搏鱼，最后记录、放生或按当前测试所述放入鱼篓。单次抛竿的结果在刷新后保持稳定。长期进度保存在设备本地。

`HANDOFF.md` 将个人探索列为产品方向，并反对售卖升级循环；`README.md` 和现有测试则记录了鱼篓、金币、出售、升级。此产品分歧尚未决策，维护时不得将其中一方默认为最终设计。

## 数据结构

- 存档至少包含钓点 `spot`、鱼饵 `bait`、抛竿计数 `casts`、当前抛竿 `pending`、探索进度及 `economy`。现有测试引用钓点 `reed`、`bridge`、`deep`。
- `pending` 至少具有 `start`、`decisionAt`、`readyAt`、`signal`、`catch` 等字段；读漂、提竿与结算须围绕同一结果运行。
- `economy` 至少具有 `coins`、`basket`、`upgrades`。旧存档迁移时需补齐缺失字段且保留已有探索进度。
- 本地键 `moonwater-v1`、存档版本、最近钓获上限、每轮竿数与读漂时间由 `src/config/game-rules.mjs` 定义。界面显示条数仍需单独核对。

## 接口与输入输出

`src/engine.mjs` 对外保留 `newSave`、`migrateSave`、`makeCast`、`chooseTactic`、`finishCast`、`processCatch`、`startNextTrip` 等函数；原有目录数据导出从 `src/data/catalog.mjs` 转发。`src/fishing-motion.js` 提供 `phaseOf`。输入是存档、时间、玩家动作与可注入随机源；输出是更新后的存档、抛竿状态或结算结果。可注入随机源使结果可复现。

一次抛竿应按准备、飞行、等待、读漂、可提竿、搏鱼或空钩、结算流转。读漂选项和反馈由鱼讯决定；不操作会随时间进入下一阶段。鱼口消失后不能无限等待。

## 边界与异常

- 刷新或重复处理同一次钓获，不应重新抽取鱼种或重复发放奖励。
- 旧存档缺失新字段时应迁移，已获得的进度不得丢失。
- 本地存储不可用时，界面应给可见提示；不得静默宣称持久化成功。
- 没有鱼或读漂失误时应进入空钩/失败路径；稀有个体不得由线索直接保证出现。

## 验证要点

运行 `tests/fishing-decisions.test.mjs`、`tests/reference-loop.test.mjs`、`tests/cast-target.test.mjs`、`tests/fishing-rhythm.test.mjs` 与 `tests/project-structure.test.mjs`，覆盖正常抛竿、读漂、迁移、重复结算、失误和边界时间。当前测试框架为 Node `node:test`，尚无 Unity Test Framework 工程。
