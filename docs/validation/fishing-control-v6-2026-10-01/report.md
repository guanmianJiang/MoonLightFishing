# 核心操作连续表面 V6 验证报告

日期：2026-10-01。范围：独立设计样例、纯几何、规格与离线资源检查。运行UI未由本轮替换。

## 问题与结果

V5的杏色面独立平移，暴露不同色的整块底板，割裂为两个物体；外置箭头被玩家否定。V6取消底板和四箭头，采用同色连续表面：后缘锚定、前缘随力偏压、同源顶/底曲线通过侧沿连接，整体厚度7→3px、单个短边缘反馈、220ms阻尼释放。仍保留四向/斜向、单指针捕获、原抬竿/让线门槛，没有新增物理玩法。

回归中发现演示的虚拟指针提前拦截真实pointerdown，修复为演示可被新触控立即接管；已持有真实指针时第二指针仍不能接管。

## 参考检索

- Apple WWDC21：[Tap into virtual and physical game controllers](https://developer.apple.com/videos/play/wwdc2021/10081/)，读取统一输入反馈、定位图形和适配内容。借鉴交互一致性，不复制系统控制器外观。
- [Kenney UI Pack](https://kenney.nl/assets/ui-pack)，核查按钮/滑动控件类别并查看其控件预览，借鉴统一状态层次；未下载套件或替换游戏图标。
- [Material Design形态与运动研究](https://m3.material.io/blog/material-3-carousel-research-design)，搜索索引提供自适应形变与平滑运动说明；当前页面正文仅返回JavaScript占位，不能声称完整查看动态演示。
- 尝试读取ShaderToy Raymarching Primitives及IQ距离函数/smooth-minimum文章，访问失败。本轮没有借用其代码，也不声称已查看其视觉。实现为小SVG连续曲面，未加入新WebGL上下文或全屏shader。

## 测试与离线视觉证据

- `node --test tests/fishing-control-v6.test.mjs tests/fishing-control-v5.test.mjs`：26项通过，其中V6 13项、V5历史回归13项。V6覆盖几何源码同源、后缘锚定、顶底曲面连接、四向等范围与斜向、有限值/压限、实际三次曲线采样无自交及切线连续、局部弧/危险优先、288/320/390宽竖屏边界、原动作门槛/回中/拒绝、第二指针、风险、咬稳/挂物、阻尼结束与接管、取消/隐藏、减少动态与有限回放。
- `surface-states.png`：收线、左调竿、抬竿、让线、斜向调竿、临界状态离线渲染，检查同色侧沿、无绿底块与无箭头。`portrait-left.png`：旧静态3D背景上的左移构图；未遮住角色头部、竿线或浮漂焦点。不是最新游戏场景验证。
- 图像由 `tools/render-fishing-control-design.mjs` 运行实际样例脚本取得路径和属性，使用同一SVG/CSS做离线渲染；生成过程不启动浏览器/桌面。资源渲染器从临时工具目录载入，不改项目运行依赖。SVG原件见 `surface-left.svg`。
- 可交互片段由 `tools/build-fishing-control-design.mjs` 从模板/CSS/纯几何与现有图标生成；发布副本与仓库源一致。实际测试日志见 `prototype-tests.log`。

## 一致性和未验证

V4/V5标为历史，V6规格、沿海UI规格、总清单记录设计草案；没有把独立样例登记为运行完成。只检查本轮文件，保留其他聊天的未提交修改。

遵守玩家要求，未使用Computer Use或任何桌面/浏览器自动化替代。SVG离线渲染不是浏览器布局/实画验收；原型初始状态、指针、回弹和减少动态由真实脚本测试，但浏览器合成效果仍待检查。

真机连续触控、safe-area、拇指遮挡、极端镜头净空、新玩家发现性、引擎真实accepted/机会/风险接入、声音/触觉同步与低端设备指针延迟/帧时间未验证。本轮没有修改运行物理/存档/3D渲染，未执行全量构建。
