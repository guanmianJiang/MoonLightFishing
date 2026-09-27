# 搏鱼与钓线规格

> 状态：源码已恢复，纯逻辑测试已运行；视觉表现仍待验收。依据 `src/reference-loop.mjs`、`src/fishing-motion.js` 及配套测试维护。

## 目标与范围

鱼距、出线长度、线张力与竿弯共同驱动搏鱼反馈。玩家收线、放线和抬竿应有不同效果；鱼的游动、转向、潜水和出水应与同一状态一致。

## 数据结构与接口

- `src/reference-loop.mjs` 的 `createFight`、`stepFight`、`pumpOpportunity`、`pumpRod` 维护搏鱼状态，至少暴露 `status`、`tension`、`fishPosition`、`lineLength`、`reelTurns`、`spoolVelocity`。
- `createFight({weight})` 初始化搏鱼状态；`stepFight(state, reeling, dt)` 随时间推进并改变状态。测试预期状态可达 `won` 或 `lost`。
- 钓线几何由竿尖、浮漂/鱼位置、松线和受力决定，主要位于 `src/fishing-motion.js`；飞行与阶段动作也由它和 `src/cast-flight.mjs` 协作。
- 鱼的朝向、鱼嘴和钩点关系由 `tests/fight-fish-motion.test.mjs`、`tests/fish-attachment.test.mjs` 约束。

## 输入输出与规则

输入包括鱼体重、帧间隔、收线/放线/抬竿动作及鱼的自主运动；输出包括鱼距、出线、张力、疲劳、动画姿态与胜负。固定物理步长应使不同显示帧率得到接近的结果。绷紧的线应传递负载，松线应下垂；冲刺时放线可降低过载风险，合适时机抬竿应产生可测的拉近效果。

## 边界与异常

- 过载不能持续无限收线；持续无操作也应有失败终点。
- 抬竿不能无条件获得收益；需要合适窗口。
- 钓获近岸前应保持入水状态，出水动作与钩点相连。
- 对零长度、极小或大帧间隔等输入的数值稳定性，继续按后续修改逐项确认并补测。

## 验证要点

现有 `tests/reference-loop.test.mjs` 涵盖收放线、胜负、固定步长与抬竿；`tests/fishing-line.test.mjs`、`tests/fight-rig.test.mjs`、`tests/fight-fish-motion.test.mjs`、`tests/landing-motion.test.mjs` 覆盖线形、反馈和鱼体运动。视觉质量仍需录屏/截图核验。
