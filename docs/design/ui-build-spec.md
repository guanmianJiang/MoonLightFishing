# 界面、构建与资源交付规格

> 状态：源码与资源已恢复，构建通过；浏览器交互仍待验收。依据 `package.json`、`vite.config.js`、`tools/verify-build.mjs` 和界面测试维护。

## 目标与范围

界面提供钓点/鱼饵选择、抛竿控制、读漂与搏鱼引导、收获处理、手记/出行摘要及设备本地进度提示。构建把前端代码和运行资源一起输出到 `build/`，供静态托管。

## 数据、接口与依赖

- `package.json` 声明 Vite 6、SolidJS、Three.js；脚本为 `npm run dev`、`npm run build`、`npm run preview`。
- `vite.config.js` 以 `src/` 为源码根目录，输出到 `build/`，由 Vite 复制 `public/assets/`；还引用 `src/render-settings.js`。开发服务器的本地画面参数写入接口需同源、JSON、大小和字段校验。
- `tools/verify-build.mjs` 检查生成页面、JS/CSS 包、关键模型、贴图、字体与音频清单。`npm run build` 已通过。
- 活动界面入口为 `src/app-final.js` 与 `src/ui/`，存档键为 `moonwater-v1`，由 `src/config/game-rules.mjs` 统一定义。

## 输入输出与边界

用户输入可来自触摸、鼠标和键盘；界面应把操作映射到同一游戏状态。移动端拖拽必须落在可及水域，桌面画幅居中。存储失败应明确提醒。关闭收获弹窗不得无意替玩家作出记录或放生决定。

## 异常与验证

缺少 `src/`、关键资源或工具依赖时，构建应失败并报告具体缺口，不得把旧构建副本当作发布目录。`tests/result-dialog.test.mjs` 读取活动入口，`tests/trip-summary.test.mjs`、`tests/cast-target.test.mjs`、`tests/project-structure.test.mjs` 和 `tools/verify-build.mjs` 提供自动验证；交互可用性仍需浏览器与真机检查。
