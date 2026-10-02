# 竖屏UI分辨率适配

日期：2026-10-02。依赖HANDOFF、coastal-ui、button-states及ui-build规格。

## 目标

以9:16手机竖屏为主，按游戏画幅实际CSS像素适配，而非桌面浏览器宽度。限制宽屏拉伸；320px窄屏保留44px触控入口，短屏减少次要排版占用，核心124px四向输入不缩放。弹窗与设置面板不溢出画幅，软键盘出现时按可视高度限制滚动区域。保留现有材质与玩法，不增加贴图、shader或逐帧测量。

## 数据与接口

`responsiveUILayout(width,height)`纯函数输出gutter、actionWidth、routeBodyMax、widthMode（narrow/regular）、heightMode（short/regular）。非法/零值采用320×568回退；gutter限定8..16，主按钮宽160..248，详情区40..160。宽小于350窄版、高小于680短版。

`mountResponsiveUI(game,window)`用ResizeObserver读取实际game尺寸，将tokens写入game、宽高模式写入dataset，并将frameWidth和visualViewport高度/offsetTop发布到documentElement供body外弹窗使用。视觉视口resize/scroll仅更新高度/位置，不缩放场景或重置玩家输入；window resize为无Observer回退。相同token不重复写入，返回dispose清理Observer和事件。零尺寸不使样式出现NaN。

最终`responsive-ui.css`在button-states之后加载，仅覆盖布局，保留状态反馈。游戏height使用100dvh并有100vh回退，最大宽480px；比9:16更宽的视口限制为高度比例宽，横屏保留最低280px可用宽且不超过屏幕。使用实际画幅tokens统一页边、安全区、顶部/底部位置。瞄准按钮不再依赖vw；短屏详情内部滚动，底部区域限制高度并保持操作可达。窄屏品牌缩短、工具仍44px；搏鱼顶部卡片与工具分行，保留图文状态与核心输入。

弹窗宽按game画幅减页边，max-height按visualViewport减安全区，结果/手记保持内部滚动；设置面板限制在画幅内，字段窄屏换行，页头/页尾与内容采用flex独立滚动。横屏为兼容检查，保留输入并缩小非核心排版，不隐藏主操作。

## 验证与边界

可视高度低于480px时设置面板靠近视口顶部，给键盘后的字段/底部操作更多空间；窄屏字段换行也依据实际画幅模式。极窄/横屏安全区压缩时，鱼饵入口保持44px并允许横向滚动，不把入口挤小。

Node测试覆盖320×568、360×640、390×844、430×932、桌面窄画幅、横屏短画幅、非法尺寸、实际Observer接线、键盘视口变化、重复写抑制与dispose；CSS解析检查最终顺序、无vw主按钮、安全区、滚动和核心尺寸不缩放。运行全量测试、构建。沿用用户要求不进入游戏、不使用Computer Use；静态与模拟DOM验证不代表浏览器实画或真机验收。后续实机检查浏览器地址栏伸缩、刘海、长文本、键盘、连续四向拖动及低端帧时间。
