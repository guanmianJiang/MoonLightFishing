# Windows 本地游戏启动器规格

## 目标

双击根目录下的 `月隐湾启动器.exe` 直接打开 Windows 原生窗口，**不经过 cmd / PowerShell 命令行**，自动启动游戏服务并在窗口中显示状态、实际游戏地址和运行记录。窗口只提供「启动/停止」切换、打开游戏与退出三个操作，收起之前「启动 / 重启 / 停止」三键的重复。退出窗口时停止由该窗口启动的游戏服务，不留下常驻命令行。

## 数据、接口与输入输出

- `tools/launcher.cs` 是单文件 C# WinForms 源码；`tools/build-launcher.ps1` 用 .NET Framework 自带 `csc.exe` 编译成 `月隐湾启动器.exe`（winexe，无控制台窗口）。编译产物即用户双击入口。
- 状态为 `stopped`、`installing`、`starting`、`running` 或 `error`；按钮按状态启用：
  - 主切换按钮：`stopped/error` 时显示「启动游戏」，`running/starting/installing` 时显示「停止游戏」；安装中禁用。
  - 「打开游戏」仅在 `running` 且已解析到地址时可用。
  - 「退出」始终可用；关闭窗口或点退出都会停止本次服务并清理进程。
- 若缺少 Vite（`node_modules/vite/bin/vite.js`），执行 `npm ci --no-audit --no-fund` 并显示安装日志，安装成功后自动继续启动。游戏进程运行 Node 的 `node_modules/vite/bin/vite.js --config vite.config.js --host 127.0.0.1`。
- 异步读取游戏进程输出时累计近期 stdout/stderr 文本，去除 ANSI 控制码后，用正则 `Local:\s*(http://(?:127\.0\.0\.1|localhost):\d+/)` 取得实际地址。地址与标签被拆到不同回调时仍必须识别。端口占用时接受 Vite 顺延后的端口。「打开游戏」在默认浏览器打开该地址。
- 自动打开浏览器必须由窗口 UI 线程触发，并使用 Windows Shell 的默认浏览器关联；成功或失败都写入运行记录。服务启动后 30 秒仍无本地地址时，显示超时并允许重试。
- 启动状态须在开始读取子进程输出前设置；旧进程的迟到输出不得把停止态改回运行态。点击启动立即显示请求和错误，不能让用户看到无反馈的按钮。
- Node 定位先检查 PATH，再检查常见的用户级和系统级安装目录，以兼容资源管理器持有旧 PATH 的情况。
- Node 缺失时在窗口内显示「未找到 Node.js，请先安装」；启动器自身只持有自己创建的安装和游戏进程，浏览器标签页不负责服务生命周期。

## 边界与异常

- 重复点击启动不会创建新服务；`running/starting/installing` 期间主按钮切为停止。
- 安装失败、服务异常退出及启动失败在窗口中显示，并保留日志供重试。
- 无浏览器自动打开时给出手动地址，由用户自行访问。
- 游戏本身仍是浏览器页面；启动器界面是 Windows 原生窗口。

## 验证

- `tests/launcher-native.test.mjs` 检查 `tools/launcher.cs` 源码控件与生命周期绑定、`月隐湾启动器.exe` 产物存在、地址解析与失败态提示。
- Windows 上运行 `tools/build-launcher.ps1` 编译通过；实际双击 `月隐湾启动器.exe` 核对启动、停止、打开游戏、退出与进程清理。
