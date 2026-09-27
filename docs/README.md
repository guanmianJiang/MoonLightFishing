# 项目文档入口

- [已实现功能总清单](IMPLEMENTED.md)：按当前仓库证据登记完成项、版本与验证状态。
- [架构与维护地图](ARCHITECTURE.md)：当前入口、模块边界、资产归属和待决事项。
- [垂钓流程与存档规格](design/fishing-loop-spec.md)：选点、抛竿、读漂、结算及持久化。
- [搏鱼与钓线规格](design/fight-simulation-spec.md)：收放线、张力、鱼体运动和胜负。
- [场景、水面与镜头规格](design/scene-water-spec.md)：渲染、交互水面、镜头和美术验收。
- [界面、构建与资源交付规格](design/ui-build-spec.md)：界面、输入、构建及发布资源。
- [项目结构与配置规格](design/project-structure-spec.md)：源码、运行资产、生产资产、测试和构建边界。

`HANDOFF.md` 是历史产品与美术交接材料；根目录 `README.md` 是当前运行入口。两者的产品分歧见 `ARCHITECTURE.md` 与 `IMPLEMENTED.md` 的待决项。

## 每次迭代

按仓库根目录 `AGENTS.md`：先更新对应 spec，再修改业务代码，再写正常与边界单元测试，然后更新 `IMPLEMENTED.md`，最后做代码、测试、文档一致性检查。一次提交同时包含业务代码、测试和文档。纯文档整理或渲染/美术资源变更在一致性报告中说明无对应业务单元测试的原因。
