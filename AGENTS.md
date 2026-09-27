# 项目开发规范

本仓库位于 `D:\MoonWaterFishing\MoonLightFishing`。旧目录 `D:\MoonWaterFishing\MoonWaterFishing` 不再使用。以下流程适用于本仓库后续需求、代码修改和 bug 修复。

1. **先文档后代码。** 先审阅现有说明和 `docs/design/`；新增模块建立 `docs/design/xxx-spec.md`，修改模块先更新对应 spec。规格应写目标、数据结构、接口、输入输出、边界和异常行为。
2. **实现代码。** 按已更新的 spec 修改。
3. **配套单元测试。** 新功能、逻辑修改和 bug 修复必须覆盖正常流程和边界 case，优先抽离引擎依赖。用户指定 Unity Test Framework；当前仓库实际为 JavaScript/Vite，现有用例使用 Node `node:test` 且没有 Unity 工程。不得把 Node 测试冒充为 Unity Test Framework；涉及后续逻辑开发时，先核实 Unity 工程是否已迁入或由用户明确测试落地方式，仍需完成可执行的业务单元测试。渲染和美术资源难以单测时在报告注明，并做适用的视觉/资源验证。
4. **更新总清单。** 在 `docs/IMPLEMENTED.md` 追加或更新条目，包含功能名称、目标、等级/优先级、依赖模块、测试要点、完成版本。未经源码及测试核实的历史描述不得记为已完成。
5. **一致性检查。** 核对代码逻辑、单元测试与文档，报告不一致点和未验证项。

交付输出使用【spec.md】【代码实现】【单元测试】【IMPLEMENTED.md更新片段】【一致性检查报告】五个部分。一次功能提交应同时包含业务代码、单元测试和 Markdown 文档，并遵循仓库既有提交习惯。纯文档维护无需虚构业务代码或单元测试，但须在相应部分说明。
