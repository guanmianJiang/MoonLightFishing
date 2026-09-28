using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace MoonLauncher
{
    public class LauncherForm : Form
    {
        private readonly string root;
        private Process gameProcess;
        private Process installProcess;
        private string gameUrl;
        private string phase;
        private int gameExitCode;
        private DateTime gameStartTime;
        private readonly object outputGate = new object();
        private string recentOutput = "";

        private Label statusLabel;
        private Label addressLabel;
        private Button toggleButton;
        private Button openButton;
        private Button exitButton;
        private TextBox logBox;
        private Timer pollTimer;

        public LauncherForm()
        {
            root = AppDomain.CurrentDomain.BaseDirectory;
            phase = "stopped";
            gameUrl = null;
            BuildUI();
            Shown += OnShown;
            FormClosing += OnFormClosing;
        }

        private void BuildUI()
        {
            ClientSize = new Size(560, 440);
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(20, 43, 49);
            ForeColor = Color.FromArgb(236, 248, 245);
            Font = new Font("Microsoft YaHei UI", 10f);
            Text = "月隐湾 · 游戏启动器";

            // 顶栏
            var title = new Label();
            title.Text = "月隐湾";
            title.Location = new Point(34, 24);
            title.Size = new Size(260, 52);
            title.Font = new Font("Microsoft YaHei UI", 26f, FontStyle.Bold);
            title.ForeColor = Color.White;
            Controls.Add(title);

            var subtitle = new Label();
            subtitle.Text = "本地休闲垂钓 · 原生启动器";
            subtitle.Location = new Point(36, 78);
            subtitle.Size = new Size(320, 22);
            subtitle.Font = new Font("Microsoft YaHei UI", 9f);
            subtitle.ForeColor = Color.FromArgb(166, 210, 204);
            Controls.Add(subtitle);

            // 状态区
            statusLabel = new Label();
            statusLabel.Text = "● 已停止";
            statusLabel.Location = new Point(34, 116);
            statusLabel.Size = new Size(492, 32);
            statusLabel.Font = new Font("Microsoft YaHei UI", 15f, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(180, 204, 201);
            Controls.Add(statusLabel);

            addressLabel = new Label();
            addressLabel.Text = "游戏尚未启动";
            addressLabel.Location = new Point(36, 150);
            addressLabel.Size = new Size(490, 22);
            addressLabel.Font = new Font("Microsoft YaHei UI", 9f);
            addressLabel.ForeColor = Color.FromArgb(180, 204, 201);
            Controls.Add(addressLabel);

            // 分隔线
            var sep = new Panel();
            sep.Location = new Point(34, 180);
            sep.Size = new Size(492, 1);
            sep.BackColor = Color.FromArgb(48, 94, 98);
            Controls.Add(sep);

            // 按钮行
            toggleButton = MakeButton("启动游戏", new Point(34, 192), new Size(210, 42));
            openButton = MakeButton("打开游戏", new Point(256, 192), new Size(120, 42));
            exitButton = MakeButton("退出", new Point(388, 192), new Size(138, 42));
            openButton.Enabled = false;

            // 运行记录
            var logCaption = new Label();
            logCaption.Text = "运行记录";
            logCaption.Location = new Point(34, 246);
            logCaption.Size = new Size(200, 20);
            logCaption.Font = new Font("Microsoft YaHei UI", 9f);
            logCaption.ForeColor = Color.FromArgb(166, 210, 204);
            Controls.Add(logCaption);

            logBox = new TextBox();
            logBox.Location = new Point(32, 268);
            logBox.Size = new Size(496, 150);
            logBox.Multiline = true;
            logBox.ReadOnly = true;
            logBox.ScrollBars = ScrollBars.Vertical;
            logBox.BackColor = Color.FromArgb(10, 30, 35);
            logBox.ForeColor = Color.FromArgb(190, 224, 217);
            logBox.Font = new Font("Consolas", 9f);
            logBox.BorderStyle = BorderStyle.FixedSingle;
            Controls.Add(logBox);

            // 底部状态条
            var footer = new Panel();
            footer.Dock = DockStyle.Bottom;
            footer.Height = 2;
            footer.BackColor = Color.FromArgb(48, 94, 98);
            Controls.Add(footer);
        }

        private Button MakeButton(string text, Point loc, Size size)
        {
            var b = new Button();
            b.Text = text;
            b.Location = loc;
            b.Size = size;
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderSize = 0;
            b.BackColor = Color.FromArgb(48, 94, 98);
            b.ForeColor = Color.White;
            b.Font = new Font("Microsoft YaHei UI", 10f);
            Controls.Add(b);
            return b;
        }

        private void OnShown(object sender, EventArgs e)
        {
            toggleButton.Click += OnToggle;
            openButton.Click += OnOpen;
            exitButton.Click += delegate { Close(); };

            pollTimer = new Timer();
            pollTimer.Interval = 300;
            pollTimer.Tick += OnPoll;
            pollTimer.Start();

            AppendLog("月隐湾原生启动器已就绪。");
            StartGame();
        }

        private void OnToggle(object sender, EventArgs e)
        {
            if (phase == "running" || phase == "starting")
            {
                AppendLog("已收到停止指令。");
                StopGame();
            }
            else
            {
                StartGame();
            }
        }

        private void OnOpen(object sender, EventArgs e)
        {
            OpenBrowser(false);
        }

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr handle);

        [DllImport("user32.dll")]
        private static extern bool ShowWindowAsync(IntPtr handle, int command);

        private void OpenBrowser(bool automatic)
        {
            if (gameUrl == null) return;
            try
            {
                var psi = new ProcessStartInfo(gameUrl);
                psi.UseShellExecute = true;
                psi.Verb = "open";
                psi.WindowStyle = ProcessWindowStyle.Normal;
                Process browser = Process.Start(psi);
                AppendLog((automatic ? "已自动打开默认浏览器：" : "已打开默认浏览器：") + gameUrl);
                if (browser != null)
                {
                    try
                    {
                        browser.WaitForInputIdle(1000);
                        browser.Refresh();
                        if (browser.MainWindowHandle != IntPtr.Zero)
                        {
                            ShowWindowAsync(browser.MainWindowHandle, 9);
                            SetForegroundWindow(browser.MainWindowHandle);
                        }
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                AppendLog("打开浏览器失败，请点击「打开游戏」或手动访问 " + gameUrl + "（" + ex.Message + "）");
            }
        }

        private void OnFormClosing(object sender, FormClosingEventArgs e)
        {
            if (pollTimer != null) pollTimer.Stop();
            StopProcesses();
        }

        // ---- 状态与 UI ----

        private void SetState(string newPhase, string message)
        {
            phase = newPhase;
            bool busy = (newPhase == "installing");
            bool running = (newPhase == "running");
            Ui(delegate
            {
                statusLabel.Text = "● " + message;
                Color c;
                switch (newPhase)
                {
                    case "running": c = Color.FromArgb(115, 224, 174); break;
                    case "error": c = Color.FromArgb(248, 153, 139); break;
                    case "starting":
                    case "installing": c = Color.FromArgb(245, 205, 128); break;
                    default: c = Color.FromArgb(180, 204, 201); break;
                }
                statusLabel.ForeColor = c;
                toggleButton.Text = (running || newPhase == "starting") ? "停止游戏" : "启动游戏";
                toggleButton.Enabled = !busy;
                openButton.Enabled = running && gameUrl != null;
                addressLabel.Text = (gameUrl != null) ? gameUrl : "游戏尚未启动";
            });
        }

        private void AppendLog(string line)
        {
            Ui(delegate
            {
                logBox.AppendText(line + Environment.NewLine);
                logBox.SelectionStart = logBox.Text.Length;
                logBox.ScrollToCaret();
            });
        }

        private void Ui(Action a)
        {
            try
            {
                if (IsHandleCreated && !IsDisposed)
                {
                    if (InvokeRequired) BeginInvoke((MethodInvoker)delegate { if (!IsDisposed) a(); });
                    else a();
                }
            }
            catch { }
        }

        // ---- 进程管理 ----

        private static string FindNode()
        {
            string path = Environment.GetEnvironmentVariable("PATH");
            if (path != null)
            {
                foreach (string d in path.Split(';'))
                {
                    if (d.Length == 0) continue;
                    try
                    {
                        string p = Path.Combine(d.Trim(), "node.exe");
                        if (File.Exists(p)) return p;
                    }
                    catch { }
                }
            }
            string[] fallback = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "nodejs", "node.exe")
            };
            foreach (string p in fallback) if (File.Exists(p)) return p;
            return null;
        }

        private void StartGame()
        {
            if (phase == "running" || phase == "starting" || phase == "installing") return;
            string node = FindNode();
            if (node == null)
            {
                SetState("error", "未找到 Node.js，请先安装 Node.js");
                AppendLog("未找到 Node.js。请到 https://nodejs.org 安装后重试。");
                return;
            }

            string vite = Path.Combine(root, "node_modules", "vite", "bin", "vite.js");
            if (!File.Exists(vite))
            {
                StartInstall(node);
                return;
            }

            gameUrl = null;
            lock (outputGate) recentOutput = "";
            Ui(delegate { logBox.Clear(); });
            SetState("starting", "正在启动游戏…");
            gameStartTime = DateTime.UtcNow;
            AppendLog("已收到启动指令，正在启动本地游戏服务…");

            try
            {
                var psi = new ProcessStartInfo();
                psi.FileName = node;
                psi.Arguments = "\"" + vite + "\" --config vite.config.js --host 127.0.0.1";
                psi.WorkingDirectory = root;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.CreateNoWindow = true;
                gameProcess = new Process();
                gameProcess.StartInfo = psi;
                gameProcess.OutputDataReceived += OnGameOutput;
                gameProcess.ErrorDataReceived += OnGameOutput;
                gameProcess.Start();
                gameProcess.BeginOutputReadLine();
                gameProcess.BeginErrorReadLine();
            }
            catch (Exception ex)
            {
                if (gameProcess != null) { try { gameProcess.Dispose(); } catch { } gameProcess = null; }
                SetState("error", "启动失败：" + ex.Message);
                AppendLog("启动失败：" + ex.Message);
            }
        }

        private void StartInstall(string node)
        {
            try
            {
                var psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/d /c npm ci --no-audit --no-fund";
                psi.WorkingDirectory = root;
                psi.UseShellExecute = false;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.CreateNoWindow = true;
                psi.EnvironmentVariables["PATH"] = Path.GetDirectoryName(node) + Path.PathSeparator + Environment.GetEnvironmentVariable("PATH");
                installProcess = new Process();
                installProcess.StartInfo = psi;
                installProcess.OutputDataReceived += OnInstallOutput;
                installProcess.ErrorDataReceived += OnInstallOutput;
                installProcess.Start();
                installProcess.BeginOutputReadLine();
                installProcess.BeginErrorReadLine();
                SetState("installing", "正在安装游戏依赖…");
                AppendLog("检测到缺少依赖，正在执行 npm ci …");
            }
            catch (Exception ex)
            {
                SetState("error", "安装失败：" + ex.Message);
                AppendLog("安装失败：" + ex.Message);
            }
        }

        private void StopGame()
        {
            StopProcesses();
            SetState("stopped", "已停止");
            AppendLog("游戏服务已停止。");
        }

        private void StopProcesses()
        {
            // 用 taskkill /T 结束整棵进程树，避免 vite 的子进程残留
            if (gameProcess != null)
            {
                try
                {
                    if (!gameProcess.HasExited)
                    {
                        var psi = new ProcessStartInfo();
                        psi.FileName = "taskkill.exe";
                        psi.Arguments = "/PID " + gameProcess.Id + " /T /F";
                        psi.CreateNoWindow = true;
                        psi.UseShellExecute = false;
                        using (Process killer = Process.Start(psi)) { if (killer != null) killer.WaitForExit(3000); }
                    }
                }
                catch { }
                try { gameProcess.Dispose(); } catch { }
                gameProcess = null;
            }
            if (installProcess != null)
            {
                try
                {
                    if (!installProcess.HasExited)
                    {
                        var psi = new ProcessStartInfo();
                        psi.FileName = "taskkill.exe";
                        psi.Arguments = "/PID " + installProcess.Id + " /T /F";
                        psi.CreateNoWindow = true;
                        psi.UseShellExecute = false;
                        using (Process killer = Process.Start(psi)) { if (killer != null) killer.WaitForExit(3000); }
                    }
                }
                catch { }
                try { installProcess.Dispose(); } catch { }
                installProcess = null;
            }
            gameUrl = null;
            lock (outputGate) recentOutput = "";
        }

        public static string ParseGameUrl(string output)
        {
            string clean = Regex.Replace(output ?? "", @"\x1B\[[0-9;]*m", "");
            Match match = Regex.Match(clean, @"Local:\s*(http://(?:127\.0\.0\.1|localhost):\d+/)");
            return match.Success ? match.Groups[1].Value : null;
        }

        private void OnGameOutput(object sender, DataReceivedEventArgs e)
        {
            if (!object.ReferenceEquals(sender, gameProcess) || phase == "stopped") return;
            if (string.IsNullOrEmpty(e.Data)) return;
            AppendLog(e.Data);
            string parsed;
            lock (outputGate)
            {
                recentOutput += e.Data + "\n";
                if (recentOutput.Length > 8192) recentOutput = recentOutput.Substring(recentOutput.Length - 8192);
                parsed = ParseGameUrl(recentOutput);
            }
            if (parsed != null && gameUrl == null)
            {
                gameUrl = parsed;
                SetState("running", "游戏运行中");
                AppendLog("游戏地址：" + gameUrl);
                string url = gameUrl;
                Ui(delegate { if (phase == "running" && gameUrl == url) OpenBrowser(true); });
            }
        }

        private void OnInstallOutput(object sender, DataReceivedEventArgs e)
        {
            if (!string.IsNullOrEmpty(e.Data)) AppendLog(e.Data);
        }

        private void OnPoll(object sender, EventArgs e)
        {
            if (phase == "starting" && gameProcess != null && (DateTime.UtcNow - gameStartTime).TotalSeconds > 30)
            {
                StopProcesses();
                SetState("error", "游戏服务启动超时");
                AppendLog("30 秒内未收到游戏地址，请检查上方日志后重试。");
            }
            if (gameProcess != null)
            {
                try
                {
                    gameProcess.Refresh();
                    if (gameProcess.HasExited)
                    {
                        gameExitCode = gameProcess.ExitCode;
                        gameProcess.Dispose();
                        gameProcess = null;
                        gameUrl = null;
                        SetState("error", "游戏服务已退出（代码 " + gameExitCode + "）");
                        AppendLog("游戏服务已退出。");
                    }
                }
                catch { }
            }
            if (installProcess != null)
            {
                try
                {
                    installProcess.Refresh();
                    if (installProcess.HasExited)
                    {
                        int code = installProcess.ExitCode;
                        installProcess.Dispose();
                        installProcess = null;
                        if (code == 0)
                        {
                            Ui(delegate { AppendLog("依赖安装完成，继续启动游戏…"); StartGame(); });
                        }
                        else
                        {
                            Ui(delegate { SetState("error", "依赖安装失败（代码 " + code + "）"); AppendLog("依赖安装失败（代码 " + code + "）。请检查网络后重试。"); });
                        }
                    }
                }
                catch { }
            }
        }
    }

    public static class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }
}
