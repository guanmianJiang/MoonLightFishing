# 通用按钮状态校验

日期：2026-10-01。规格：`docs/design/button-states-spec.md`。

## 已核实

- 新的通用样式层最后加载，覆盖旧按钮状态；普通控件使用浅海盐绿，主操作暖杏色，选中/展开浅鼠尾草绿。钓点保持原水平/垂直transform锚点，锁定钓点保留可点击解释入口及弱化颜色。
- 所有现有CSS的hover规则限制在hover:hover及pointer:fine内。混合hover/focus选择器拆分后，焦点保留独立适用范围。禁用优先于按压/hover，减少动态关闭位移过渡。
- 镜头按钮aria-pressed映射实际closeView，手记页签绑定现有active状态；声音/设置沿用现有属性。未修改选择、解锁、钓获处理等业务决策。
- 核心fightHold排除于通用层，保留专用连续几何与四向输入。未新增资源、shader、3D绘制或持续动画。

## 验证结果

- `node --test tests/button-states.test.mjs tests/reel-input-runtime.test.mjs tests/reel-surface-runtime.test.mjs tests/scene-tools-visibility.test.mjs`：25项通过，其中7项为本轮新增。
- `npm test`：586项通过，0失败。
- `npm run build`：通过，页面入口、代码、模型、贴图及音频构建资源校验通过。
- 代码、规格与实现清单对应。共享工作区其他改动保留；上述全量数量是本次工作区运行结果，不代表均为本轮新增功能。
- 本轮修改的已跟踪文件差异检查通过，app入口语法检查通过。全仓差异检查仍报告其他工作区改动中`src/scene.js`的CRLF尾空白；本轮未修改该文件，也未清理他人改动。

## 未验证

用户明确要求不进入游戏验证，本轮没有使用Computer Use、浏览器、游戏实画或替代截图。样式校验属于源码/规则校验，不能证明最终视觉观感。手机safe-area、极端文本、实际触感与低端设备快速交互帧时间仍待真机验证。
