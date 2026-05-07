use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use toml_edit::{value, DocumentMut};

struct AppState {
    proxy: Mutex<Option<Child>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxySettings {
    responses_url: String,
    api_key: String,
    #[serde(default)]
    completions_url: String,
    #[serde(default)]
    completions_key: String,
    host: String,
    port: u16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProxyStatus {
    running: bool,
    healthy: bool,
    url: String,
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexConfigInput {
    base_url: String,
    model: String,
    #[serde(default = "default_provider_id")]
    provider_id: String,
    #[serde(default = "default_profile_id")]
    profile_id: String,
    #[serde(default = "default_config_name")]
    name: String,
    #[serde(default)]
    skills_toml: String,
    #[serde(default)]
    mcp_toml: String,
    #[serde(default)]
    plugins_toml: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexStatusInput {
    #[serde(default = "default_provider_id")]
    provider_id: String,
    #[serde(default = "default_profile_id")]
    profile_id: String,
}

fn default_provider_id() -> String {
    "codex-turn".to_string()
}
fn default_profile_id() -> String {
    "codex-turn".to_string()
}
fn default_config_name() -> String {
    "Codex Turn".to_string()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexPreview {
    command: String,
    config_path: String,
    after: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmxStatus {
    vendor_root: String,
    commit: Option<String>,
    ready: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexConfigStatus {
    config_path: String,
    exists: bool,
    has_codex_turn: bool,
    model: Option<String>,
    base_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCommandInput {
    command: String,
    cwd: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCommandResult {
    command: String,
    cwd: String,
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationSummary {
    path: String,
    title: String,
    updated_at: String,
    message_count: usize,
    preview: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationDetail {
    path: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmxCommandResult {
    command: String,
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmxUpdateInfo {
    current_commit: String,
    latest_commit: String,
    behind: u32,
    update_available: bool,
    latest_date: String,
    latest_message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmxDoctorItem {
    name: String,
    status: String, // "pass" | "warn" | "fail"
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OmxPrerequisites {
    git: bool,
    node: bool,
    npm: bool,
    all_met: bool,
}

// ============================================================
// OMX 安装目录和辅助函数
// ============================================================

/// OMX 安装目录：~/Library/Application Support/Codex Turn/oh-my-codex
fn omx_install_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "cannot resolve home directory".to_string())?;
    Ok(home.join("Library/Application Support/Codex Turn/oh-my-codex"))
}

/// 检查单个命令是否可用
fn command_exists(name: &str) -> bool {
    Command::new("which")
        .arg(name)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 允许的 OMX 子命令白名单
const ALLOWED_OMX_COMMANDS: &[&str] = &[
    "hud", "list", "state", "doctor", "setup", "cleanup", "cancel", "team", "help", "version",
    "status",
];

// ============================================================
// 代理命令
// ============================================================

/// 查找 node 可执行文件：macOS 打包后 PATH 不含 homebrew，需要显式查找
fn find_node() -> String {
    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.to_string();
        }
    }
    // 回退到 PATH 查找
    if let Ok(output) = Command::new("/usr/bin/which").arg("node").output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }
    "node".to_string()
}

/// 查找 converter CLI 路径：优先资源目录（打包后），回退到 repo root（开发时）
fn find_converter_cli(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // 打包后的资源目录
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_candidates = [
            resource_dir.join("packages/converter/dist/src/cli.js"),
            resource_dir.join("_up_/_up_/_up_/packages/converter/dist/src/cli.js"),
        ];
        for bundled in bundled_candidates {
            if bundled.exists() {
                return Ok(bundled);
            }
        }
    }
    // 开发模式：从 repo root 查找
    let root = repo_root(app)?;
    let dev_cli = root.join("packages/converter/dist/src/cli.js");
    if dev_cli.exists() {
        return Ok(dev_cli);
    }
    Err("converter CLI not found. Ensure packages/converter is built.".to_string())
}

#[tauri::command]
fn start_proxy(settings: ProxySettings, app: tauri::AppHandle) -> Result<ProxyStatus, String> {
    if settings.port == 0 {
        return Ok(proxy_status_for(
            &settings.host,
            settings.port,
            false,
            false,
            "Invalid proxy port",
        ));
    }

    let state = app.state::<AppState>();
    let mut guard = state
        .proxy
        .lock()
        .map_err(|_| "proxy lock poisoned".to_string())?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|e| e.to_string())?.is_none() {
            let healthy = proxy_is_healthy(&settings.host, settings.port);
            return Ok(proxy_status_for(
                &settings.host,
                settings.port,
                true,
                healthy,
                if healthy {
                    "Proxy already running"
                } else {
                    "Proxy process is running, health check failed"
                },
            ));
        }
        *guard = None;
    }

    let cli = find_converter_cli(&app)?;
    let completions_url = if settings.completions_url.trim().is_empty() {
        settings.responses_url.as_str()
    } else {
        settings.completions_url.as_str()
    };
    let completions_key = if settings.completions_key.trim().is_empty() {
        settings.api_key.as_str()
    } else {
        settings.completions_key.as_str()
    };
    let mut cmd = Command::new(find_node());
    cmd.arg(&cli)
        .arg("--host")
        .arg(&settings.host)
        .arg("--port")
        .arg(settings.port.to_string())
        .arg("--responses-url")
        .arg(&settings.responses_url)
        .arg("--responses-key")
        .arg(&settings.api_key)
        .arg("--completions-url")
        .arg(completions_url)
        .arg("--chat-upstream")
        .arg("completions");
    if !completions_key.is_empty() {
        cmd.arg("--completions-key").arg(completions_key);
    }
    let child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start converter: {e}"))?;

    let mut child = child;
    thread::sleep(Duration::from_millis(350));
    if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
        let output = read_child_output(&mut child);
        let detail = if output.is_empty() {
            "no output".to_string()
        } else {
            output
        };
        return Ok(proxy_status_for(
            &settings.host,
            settings.port,
            false,
            false,
            &format!("Proxy exited immediately with status {status}: {detail}"),
        ));
    }

    let healthy = proxy_is_healthy(&settings.host, settings.port);
    *guard = Some(child);
    Ok(proxy_status_for(
        &settings.host,
        settings.port,
        true,
        healthy,
        if healthy {
            "Proxy started and healthy"
        } else {
            "Proxy started; health check pending"
        },
    ))
}

#[tauri::command]
fn stop_proxy(app: tauri::AppHandle) -> Result<ProxyStatus, String> {
    let state = app.state::<AppState>();
    let mut guard = state
        .proxy
        .lock()
        .map_err(|_| "proxy lock poisoned".to_string())?;
    if let Some(child) = guard.as_mut() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *guard = None;
    Ok(ProxyStatus {
        running: false,
        healthy: false,
        url: proxy_url("127.0.0.1", 9090),
        message: "Proxy stopped".to_string(),
    })
}

#[tauri::command]
fn proxy_status(url: String) -> ProxyStatus {
    let (host, port) = parse_proxy_url(&url).unwrap_or_else(|| ("127.0.0.1".to_string(), 9090));
    let healthy = proxy_is_healthy(&host, port);
    ProxyStatus {
        running: healthy,
        healthy,
        url: proxy_url(&host, port),
        message: if healthy {
            "Proxy is healthy"
        } else {
            "Proxy is not reachable"
        }
        .to_string(),
    }
}

// ============================================================
// Codex 配置命令
// ============================================================

#[tauri::command]
fn preview_codex_config(input: CodexConfigInput) -> Result<CodexPreview, String> {
    let path = codex_config_path()?;
    let before = fs::read_to_string(&path).unwrap_or_default();
    let after = apply_codex_turn_text(&before, &input)?;
    let command = format!("codex -p {}", input.profile_id);
    Ok(CodexPreview {
        command,
        config_path: path.display().to_string(),
        after,
    })
}

#[tauri::command]
fn apply_codex_config(input: CodexConfigInput) -> Result<CodexPreview, String> {
    let path = codex_config_path()?;
    let before = fs::read_to_string(&path).unwrap_or_default();
    let after = apply_codex_turn_text(&before, &input)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if path.exists() {
        let backup = backup_path(&path);
        fs::copy(&path, backup).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &after).map_err(|e| e.to_string())?;
    let command = format!("codex -p {}", input.profile_id);
    Ok(CodexPreview {
        command,
        config_path: path.display().to_string(),
        after,
    })
}

#[tauri::command]
fn restore_codex_default() -> Result<CodexPreview, String> {
    let path = codex_config_path()?;
    if path.exists() {
        let backup = backup_path(&path);
        fs::copy(&path, backup).map_err(|e| e.to_string())?;
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(CodexPreview {
        command: "codex (default config)".to_string(),
        config_path: path.display().to_string(),
        after: String::new(),
    })
}

#[tauri::command]
fn codex_config_status(input: CodexStatusInput) -> Result<CodexConfigStatus, String> {
    let path = codex_config_path()?;
    if !path.exists() {
        return Ok(CodexConfigStatus {
            config_path: path.display().to_string(),
            exists: false,
            has_codex_turn: false,
            model: None,
            base_url: None,
        });
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let doc = text
        .parse::<DocumentMut>()
        .map_err(|e| format!("Failed to parse config.toml: {e}"))?;
    let provider_id = input.provider_id.as_str();
    let profile_id = input.profile_id.as_str();
    let has = doc
        .get("model_providers")
        .and_then(|t| t.get(provider_id))
        .is_some();
    let model = doc
        .get("profiles")
        .and_then(|t| t.get(profile_id))
        .and_then(|t| t.get("model"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let base_url = doc
        .get("model_providers")
        .and_then(|t| t.get(provider_id))
        .and_then(|t| t.get("base_url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok(CodexConfigStatus {
        config_path: path.display().to_string(),
        exists: true,
        has_codex_turn: has,
        model,
        base_url,
    })
}

// ============================================================
// OMX 命令
// ============================================================

/// 检查 git/node/npm 是否可用
#[tauri::command]
fn omx_check_prerequisites() -> OmxPrerequisites {
    let git = command_exists("git");
    let node = command_exists("node");
    let npm = command_exists("npm");
    OmxPrerequisites {
        git,
        node,
        npm,
        all_met: git && node && npm,
    }
}

/// 获取 OMX 安装状态
#[tauri::command]
fn omx_status() -> Result<OmxStatus, String> {
    let install_dir = omx_install_dir()?;
    let commit_path = install_dir.join("VENDORED_COMMIT");
    let cli = install_dir.join("dist/cli/omx.js");
    let commit = fs::read_to_string(commit_path)
        .ok()
        .map(|s| s.trim().to_string());
    Ok(OmxStatus {
        vendor_root: install_dir.display().to_string(),
        commit,
        ready: cli.exists(),
    })
}

/// 从 GitHub 克隆 oh-my-codex 并安装构建（原子替换：先构建到临时目录，成功后再替换）
#[tauri::command]
fn omx_install() -> Result<OmxCommandResult, String> {
    let prereq = omx_check_prerequisites();
    if !prereq.git {
        return Err("git is not installed".to_string());
    }
    if !prereq.node {
        return Err("node is not installed".to_string());
    }
    if !prereq.npm {
        return Err("npm is not installed".to_string());
    }

    let install_dir = omx_install_dir()?;
    let tmp_dir = install_dir.with_extension("tmp");

    // 创建父目录
    if let Some(parent) = install_dir.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    // 清理可能残留的临时目录
    if tmp_dir.exists() {
        fs::remove_dir_all(&tmp_dir).map_err(|e| format!("Failed to clean temp directory: {e}"))?;
    }

    // git clone 到临时目录
    let clone = Command::new("git")
        .arg("clone")
        .arg("https://github.com/Yeachan-Heo/oh-my-codex.git")
        .arg(&tmp_dir)
        .output()
        .map_err(|e| format!("git clone failed: {e}"))?;
    if !clone.status.success() {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Ok(OmxCommandResult {
            command: "git clone".to_string(),
            code: clone.status.code(),
            stdout: String::from_utf8_lossy(&clone.stdout).to_string(),
            stderr: String::from_utf8_lossy(&clone.stderr).to_string(),
        });
    }

    // npm install
    let npm_install = Command::new("npm")
        .arg("install")
        .current_dir(&tmp_dir)
        .output()
        .map_err(|e| format!("npm install failed: {e}"))?;
    if !npm_install.status.success() {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Ok(OmxCommandResult {
            command: "npm install".to_string(),
            code: npm_install.status.code(),
            stdout: String::from_utf8_lossy(&npm_install.stdout).to_string(),
            stderr: String::from_utf8_lossy(&npm_install.stderr).to_string(),
        });
    }

    // npm run build
    let npm_build = Command::new("npm")
        .arg("run")
        .arg("build")
        .current_dir(&tmp_dir)
        .output()
        .map_err(|e| format!("npm run build failed: {e}"))?;
    if !npm_build.status.success() {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Ok(OmxCommandResult {
            command: "npm run build".to_string(),
            code: npm_build.status.code(),
            stdout: String::from_utf8_lossy(&npm_build.stdout).to_string(),
            stderr: String::from_utf8_lossy(&npm_build.stderr).to_string(),
        });
    }

    // 写入 VENDORED_COMMIT
    let commit_hash = Command::new("git")
        .arg("rev-parse")
        .arg("HEAD")
        .current_dir(&tmp_dir)
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        });
    if let Some(hash) = &commit_hash {
        let _ = fs::write(tmp_dir.join("VENDORED_COMMIT"), hash);
    }

    // 原子替换：删除旧目录，重命名临时目录
    if install_dir.exists() {
        fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("Failed to remove old installation: {e}"))?;
    }
    fs::rename(&tmp_dir, &install_dir)
        .map_err(|e| format!("Failed to finalize installation: {e}"))?;

    Ok(OmxCommandResult {
        command: "omx_install (clone + install + build)".to_string(),
        code: npm_build.status.code(),
        stdout: format!(
            "Installed to: {}\nCommit: {}\n{}",
            install_dir.display(),
            commit_hash.as_deref().unwrap_or("unknown"),
            String::from_utf8_lossy(&npm_build.stdout)
        ),
        stderr: String::from_utf8_lossy(&npm_build.stderr).to_string(),
    })
}

/// 通用 OMX 命令执行器，接受参数数组，返回 stdout/stderr/exit code
#[tauri::command]
fn omx_run_command(args: Vec<String>) -> Result<OmxCommandResult, String> {
    // 检查命令白名单
    if let Some(first) = args.first() {
        let cmd = first.as_str();
        if !ALLOWED_OMX_COMMANDS.contains(&cmd) {
            return Err(format!(
                "Command '{}' is not allowed. Allowed: {}",
                cmd,
                ALLOWED_OMX_COMMANDS.join(", ")
            ));
        }
    }

    let install_dir = omx_install_dir()?;
    let cli = install_dir.join("dist/cli/omx.js");
    if !cli.exists() {
        return Err("OMX not installed. Run omx_install first.".to_string());
    }
    let cmd_str = format!("omx {}", args.join(" "));
    let output = Command::new(find_node())
        .arg(&cli)
        .args(&args)
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("failed to run {}: {e}", cmd_str))?;
    Ok(OmxCommandResult {
        command: cmd_str,
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

/// 通过 GitHub API 检查 oh-my-codex 最新 commit，与当前安装对比
#[tauri::command]
fn omx_check_update() -> Result<OmxUpdateInfo, String> {
    let install_dir = omx_install_dir()?;
    let commit_path = install_dir.join("VENDORED_COMMIT");
    let current = fs::read_to_string(&commit_path)
        .map_err(|_| "OMX not installed. Run omx_install first.".to_string())?
        .trim()
        .to_string();

    // 调用 GitHub API 获取最新 commit
    let url = "https://api.github.com/repos/Yeachan-Heo/oh-my-codex/commits?per_page=1";
    let resp: String = ureq::get(url)
        .header("User-Agent", "codex-turn-app")
        .header("Accept", "application/vnd.github.v3+json")
        .call()
        .map_err(|e| format!("GitHub API request failed: {e}"))?
        .body_mut()
        .read_to_string()
        .map_err(|e| format!("Failed to read response: {e}"))?;

    let commits: serde_json::Value =
        serde_json::from_str(&resp).map_err(|e| format!("Failed to parse GitHub response: {e}"))?;

    let latest_commit = commits
        .get(0)
        .and_then(|c| c.get("sha"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    let latest_date = commits
        .get(0)
        .and_then(|c| c.get("commit"))
        .and_then(|c| c.get("committer"))
        .and_then(|c| c.get("date"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    let latest_message = commits
        .get(0)
        .and_then(|c| c.get("commit"))
        .and_then(|c| c.get("message"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    let update_available = !latest_commit.is_empty() && latest_commit != current;

    Ok(OmxUpdateInfo {
        current_commit: current,
        latest_commit,
        behind: if update_available { 1 } else { 0 },
        update_available,
        latest_date,
        latest_message,
    })
}

/// 执行 git fetch + checkout 更新安装目录源码，然后重建
#[tauri::command]
fn omx_apply_update() -> Result<OmxCommandResult, String> {
    let install_dir = omx_install_dir()?;

    // 检查是否是 git 仓库
    if !install_dir.join(".git").exists() {
        return Err("OMX installation is not a git repository. Cannot update.".to_string());
    }

    // git fetch origin
    let fetch = Command::new("git")
        .arg("fetch")
        .arg("origin")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("git fetch failed: {e}"))?;
    if !fetch.status.success() {
        return Ok(OmxCommandResult {
            command: "git fetch origin".to_string(),
            code: fetch.status.code(),
            stdout: String::from_utf8_lossy(&fetch.stdout).to_string(),
            stderr: String::from_utf8_lossy(&fetch.stderr).to_string(),
        });
    }

    // git checkout origin/main
    let checkout = Command::new("git")
        .arg("checkout")
        .arg("origin/main")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("git checkout failed: {e}"))?;
    if !checkout.status.success() {
        return Ok(OmxCommandResult {
            command: "git checkout origin/main".to_string(),
            code: checkout.status.code(),
            stdout: String::from_utf8_lossy(&checkout.stdout).to_string(),
            stderr: String::from_utf8_lossy(&checkout.stderr).to_string(),
        });
    }

    // 更新 VENDORED_COMMIT 文件
    let new_commit = Command::new("git")
        .arg("rev-parse")
        .arg("HEAD")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("git rev-parse failed: {e}"))?;
    let commit_hash = String::from_utf8_lossy(&new_commit.stdout)
        .trim()
        .to_string();
    if !commit_hash.is_empty() {
        let _ = fs::write(install_dir.join("VENDORED_COMMIT"), &commit_hash);
    }

    // npm install && npm run build
    let npm_install = Command::new("npm")
        .arg("install")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("npm install failed: {e}"))?;
    if !npm_install.status.success() {
        return Ok(OmxCommandResult {
            command: "npm install".to_string(),
            code: npm_install.status.code(),
            stdout: String::from_utf8_lossy(&npm_install.stdout).to_string(),
            stderr: String::from_utf8_lossy(&npm_install.stderr).to_string(),
        });
    }

    let npm_build = Command::new("npm")
        .arg("run")
        .arg("build")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("npm run build failed: {e}"))?;

    Ok(OmxCommandResult {
        command: "omx_apply_update (fetch + checkout + install + build)".to_string(),
        code: npm_build.status.code(),
        stdout: format!(
            "Updated to commit: {}\n{}",
            commit_hash,
            String::from_utf8_lossy(&npm_build.stdout)
        ),
        stderr: String::from_utf8_lossy(&npm_build.stderr).to_string(),
    })
}

/// 读取 oh-my-codex/templates/catalog-manifest.json 静态元数据
#[tauri::command]
fn omx_read_catalog() -> Result<serde_json::Value, String> {
    let install_dir = omx_install_dir()?;
    let manifest = install_dir.join("templates/catalog-manifest.json");
    if !manifest.exists() {
        return Err("catalog-manifest.json not found. Is OMX installed?".to_string());
    }
    let text = fs::read_to_string(&manifest).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| format!("Failed to parse catalog: {e}"))
}

/// 执行 omx doctor 并解析纯文本输出为结构化数据
#[tauri::command]
fn omx_doctor_parse() -> Result<Vec<OmxDoctorItem>, String> {
    let install_dir = omx_install_dir()?;
    let cli = install_dir.join("dist/cli/omx.js");
    if !cli.exists() {
        return Err("OMX not installed. Run omx_install first.".to_string());
    }
    let output = Command::new(find_node())
        .arg(&cli)
        .arg("doctor")
        .current_dir(&install_dir)
        .output()
        .map_err(|e| format!("failed to run omx doctor: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let items = parse_doctor_output(&stdout);
    Ok(items)
}

// ============================================================
// 终端和历史会话
// ============================================================

#[tauri::command]
fn terminal_run(input: TerminalCommandInput) -> Result<TerminalCommandResult, String> {
    let command = input.command.trim().to_string();
    if command.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let cwd = if let Some(cwd) = input
        .cwd
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        PathBuf::from(cwd)
    } else {
        std::env::current_dir().map_err(|e| format!("cannot resolve current directory: {e}"))?
    };

    let output = Command::new("/bin/zsh")
        .arg("-lc")
        .arg(&command)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("failed to run command: {e}"))?;

    Ok(TerminalCommandResult {
        command,
        cwd: cwd.display().to_string(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

#[tauri::command]
fn list_conversations() -> Result<Vec<ConversationSummary>, String> {
    let root = codex_home_dir()?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_jsonl_files(&root, &mut files)?;
    files.sort_by(|a, b| {
        let a_modified = a
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(UNIX_EPOCH);
        let b_modified = b
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(UNIX_EPOCH);
        b_modified.cmp(&a_modified)
    });

    files
        .into_iter()
        .take(120)
        .map(|path| summarize_conversation(&path))
        .collect()
}

#[tauri::command]
fn read_conversation(path: String) -> Result<ConversationDetail, String> {
    let root = codex_home_dir()?
        .canonicalize()
        .map_err(|e| format!("cannot resolve ~/.codex: {e}"))?;
    let requested = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("cannot resolve conversation path: {e}"))?;
    if !requested.starts_with(&root) {
        return Err("conversation path must be under ~/.codex".to_string());
    }
    if requested.extension().and_then(|s| s.to_str()) != Some("jsonl") {
        return Err("conversation must be a .jsonl file".to_string());
    }

    let content = fs::read_to_string(&requested).map_err(|e| e.to_string())?;
    Ok(ConversationDetail {
        path: requested.display().to_string(),
        content,
    })
}

// ============================================================
// 辅助函数
// ============================================================

fn proxy_url(host: &str, port: u16) -> String {
    format!("http://{host}:{port}/v1")
}

fn proxy_is_healthy(host: &str, port: u16) -> bool {
    let address = match format!("{host}:{port}")
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
    {
        Some(address) => address,
        None => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    let request =
        format!("GET /health HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = [0_u8; 128];
    match stream.read(&mut response) {
        Ok(count) if count > 0 => {
            String::from_utf8_lossy(&response[..count]).starts_with("HTTP/1.1 200")
        }
        _ => false,
    }
}

fn parse_proxy_url(url: &str) -> Option<(String, u16)> {
    let without_scheme = url
        .trim()
        .trim_end_matches('/')
        .strip_prefix("http://")
        .or_else(|| url.trim().trim_end_matches('/').strip_prefix("https://"))?;
    let authority = without_scheme.split('/').next()?.trim();
    let (host, port) = authority.rsplit_once(':')?;
    Some((host.to_string(), port.parse().ok()?))
}

fn read_child_output(child: &mut Child) -> String {
    let mut parts = Vec::new();
    if let Some(mut stdout) = child.stdout.take() {
        let mut text = String::new();
        if stdout.read_to_string(&mut text).is_ok() && !text.trim().is_empty() {
            parts.push(format!("stdout: {}", text.trim()));
        }
    }
    if let Some(mut stderr) = child.stderr.take() {
        let mut text = String::new();
        if stderr.read_to_string(&mut text).is_ok() && !text.trim().is_empty() {
            parts.push(format!("stderr: {}", text.trim()));
        }
    }

    let joined = parts.join(" | ");
    let max_chars = 1200;
    let truncated: String = joined.chars().take(max_chars).collect();
    if truncated.len() < joined.len() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

fn proxy_status_for(
    host: &str,
    port: u16,
    running: bool,
    healthy: bool,
    message: &str,
) -> ProxyStatus {
    ProxyStatus {
        running,
        healthy,
        url: proxy_url(host, port),
        message: message.to_string(),
    }
}

fn repo_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .resource_dir()
        .ok()
        .or_else(|| std::env::current_dir().ok())
        .ok_or_else(|| "cannot resolve app directory".to_string())?;
    loop {
        if dir.join("package.json").exists() && dir.join("packages/converter").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            return std::env::current_dir().map_err(|e| e.to_string());
        }
    }
}

fn codex_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "cannot resolve home directory".to_string())?;
    Ok(home.join(".codex/config.toml"))
}

fn codex_home_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "cannot resolve home directory".to_string())?;
    Ok(home.join(".codex"))
}

fn backup_path(path: &Path) -> PathBuf {
    let stamp = chrono::Local::now().format("%Y%m%d%H%M%S");
    PathBuf::from(format!("{}.codex-turn-backup-{stamp}", path.display()))
}

/// 验证非空 TOML 片段是否合法
fn validate_toml_fragment(label: &str, fragment: &str) -> Result<(), String> {
    if fragment.trim().is_empty() {
        return Ok(());
    }
    fragment
        .parse::<DocumentMut>()
        .map_err(|e| format!("{label} TOML parse error: {e}"))?;
    Ok(())
}

/// 删除旧的 managed block，追加新的
fn apply_managed_block(existing: &str, profile_id: &str, block_body: &str) -> String {
    let begin_tag = format!("# BEGIN CODEX TURN EXTRAS: {profile_id}");
    let end_tag = format!("# END CODEX TURN EXTRAS: {profile_id}");

    // 删除旧 block
    let mut result = String::new();
    let mut skip = false;
    for line in existing.lines() {
        if line.trim() == begin_tag {
            skip = true;
            continue;
        }
        if line.trim() == end_tag {
            skip = false;
            continue;
        }
        if !skip {
            result.push_str(line);
            result.push('\n');
        }
    }

    // 追加新 block（如果内容非空）
    let trimmed_body = block_body.trim();
    if !trimmed_body.is_empty() {
        if !result.ends_with('\n') {
            result.push('\n');
        }
        result.push_str(&begin_tag);
        result.push('\n');
        result.push_str(trimmed_body);
        result.push('\n');
        result.push_str(&end_tag);
        result.push('\n');
    }

    result
}

fn apply_codex_turn_text(existing: &str, input: &CodexConfigInput) -> Result<String, String> {
    // 验证扩展 TOML 片段
    validate_toml_fragment("Skills", &input.skills_toml)?;
    validate_toml_fragment("MCP", &input.mcp_toml)?;
    validate_toml_fragment("Plugins", &input.plugins_toml)?;

    let mut doc = if existing.trim().is_empty() {
        DocumentMut::new()
    } else {
        existing
            .parse::<DocumentMut>()
            .map_err(|e| format!("Failed to parse existing config.toml: {e}"))?
    };

    let provider_id = &input.provider_id;
    let profile_id = &input.profile_id;

    doc["model_providers"][provider_id.as_str()]["name"] = value(&input.name);
    doc["model_providers"][provider_id.as_str()]["base_url"] = value(input.base_url.clone());
    doc["model_providers"][provider_id.as_str()]["wire_api"] = value("responses");
    if let Some(table) = doc["model_providers"][provider_id.as_str()].as_table_mut() {
        table.remove("env_key");
    }
    doc["profiles"][profile_id.as_str()]["model_provider"] = value(provider_id.clone());
    doc["profiles"][profile_id.as_str()]["model"] = value(input.model.clone());

    let mut text = doc.to_string();

    // 处理 managed extras block
    let mut block_parts = Vec::new();
    if !input.skills_toml.trim().is_empty() {
        block_parts.push(format!("# skills\n{}", input.skills_toml.trim()));
    }
    if !input.mcp_toml.trim().is_empty() {
        block_parts.push(format!("# mcp\n{}", input.mcp_toml.trim()));
    }
    if !input.plugins_toml.trim().is_empty() {
        block_parts.push(format!("# plugins\n{}", input.plugins_toml.trim()));
    }
    let block_body = block_parts.join("\n\n");
    text = apply_managed_block(&text, profile_id, &block_body);

    // 验证最终 TOML 合法
    text.parse::<DocumentMut>().map_err(|e| e.to_string())?;
    Ok(text)
}

/// 解析 omx doctor 纯文本输出
/// 格式: [OK] name: message / [!!] name: message / [XX] name: message
fn parse_doctor_output(output: &str) -> Vec<OmxDoctorItem> {
    let mut items = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("[OK]") {
            let (name, message) = split_name_message(rest);
            items.push(OmxDoctorItem {
                name,
                status: "pass".to_string(),
                message,
            });
        } else if let Some(rest) = trimmed.strip_prefix("[!!]") {
            let (name, message) = split_name_message(rest);
            items.push(OmxDoctorItem {
                name,
                status: "warn".to_string(),
                message,
            });
        } else if let Some(rest) = trimmed.strip_prefix("[XX]") {
            let (name, message) = split_name_message(rest);
            items.push(OmxDoctorItem {
                name,
                status: "fail".to_string(),
                message,
            });
        }
    }
    items
}

/// 分割 "name: message" 格式
fn split_name_message(s: &str) -> (String, String) {
    let s = s.trim();
    if let Some(pos) = s.find(':') {
        let name = s[..pos].trim().to_string();
        let message = s[pos + 1..].trim().to_string();
        (name, message)
    } else {
        (s.to_string(), String::new())
    }
}

fn collect_jsonl_files(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            let _ = collect_jsonl_files(&path, files);
        } else if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            files.push(path);
        }
    }
    Ok(())
}

fn summarize_conversation(path: &Path) -> Result<ConversationSummary, String> {
    let metadata = path.metadata().map_err(|e| e.to_string())?;
    let updated_at = metadata
        .modified()
        .map(format_system_time)
        .unwrap_or_else(|_| String::new());
    let text = fs::read_to_string(path).unwrap_or_default();
    let message_count = text.lines().filter(|line| !line.trim().is_empty()).count();
    let preview = conversation_preview(&text);
    let title = if preview.is_empty() {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Conversation")
            .to_string()
    } else {
        truncate_chars(&preview, 72)
    };

    Ok(ConversationSummary {
        path: path.display().to_string(),
        title,
        updated_at,
        message_count,
        preview,
    })
}

fn format_system_time(time: SystemTime) -> String {
    let dt: chrono::DateTime<chrono::Local> = time.into();
    dt.format("%Y-%m-%d %H:%M").to_string()
}

fn conversation_preview(text: &str) -> String {
    for line in text.lines().take(80) {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if let Some(found) = first_text_value(&value) {
            let cleaned = found.split_whitespace().collect::<Vec<_>>().join(" ");
            if cleaned.len() > 2 {
                return truncate_chars(&cleaned, 180);
            }
        }
    }
    String::new()
}

fn first_text_value(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.len() > 2 {
                Some(trimmed.to_string())
            } else {
                None
            }
        }
        serde_json::Value::Array(items) => items.iter().find_map(first_text_value),
        serde_json::Value::Object(map) => {
            for key in ["content", "text", "message", "input", "output"] {
                if let Some(found) = map.get(key).and_then(first_text_value) {
                    return Some(found);
                }
            }
            map.values().find_map(first_text_value)
        }
        _ => None,
    }
}

fn truncate_chars(value: &str, limit: usize) -> String {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(limit).collect::<String>();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        truncated
    }
}

// ============================================================
// Tauri 入口
// ============================================================

pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            proxy: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_proxy,
            stop_proxy,
            proxy_status,
            preview_codex_config,
            apply_codex_config,
            restore_codex_default,
            codex_config_status,
            omx_check_prerequisites,
            omx_status,
            omx_install,
            omx_run_command,
            omx_check_update,
            omx_apply_update,
            omx_read_catalog,
            omx_doctor_parse,
            terminal_run,
            list_conversations,
            read_conversation
        ])
        .run(tauri::generate_context!())
        .expect("error while running Codex Turn");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_input() -> CodexConfigInput {
        CodexConfigInput {
            base_url: "http://127.0.0.1:9090/v1".to_string(),
            model: "gpt-4o".to_string(),
            provider_id: "codex-turn".to_string(),
            profile_id: "codex-turn".to_string(),
            name: "Codex Turn".to_string(),
            skills_toml: String::new(),
            mcp_toml: String::new(),
            plugins_toml: String::new(),
        }
    }

    fn test_input_alt() -> CodexConfigInput {
        CodexConfigInput {
            base_url: "http://10.0.0.1:8080/v1".to_string(),
            model: "claude-sonnet-4-20250514".to_string(),
            provider_id: "my-provider".to_string(),
            profile_id: "my-profile".to_string(),
            name: "My Provider".to_string(),
            skills_toml: String::new(),
            mcp_toml: String::new(),
            plugins_toml: String::new(),
        }
    }

    #[test]
    fn apply_empty_creates_new_doc() {
        let result = apply_codex_turn_text("", &test_input()).unwrap();
        // toml_edit quotes keys containing dashes
        assert!(result.contains("codex-turn"));
        assert!(result.contains("model_providers"));
        assert!(result.contains("profiles"));
        assert!(result.contains("base_url"));
        assert!(result.contains("http://127.0.0.1:9090/v1"));
        assert!(result.contains("gpt-4o"));
    }

    #[test]
    fn apply_merges_with_existing() {
        let existing = "[other_section]\nkey = \"value\"\n";
        let result = apply_codex_turn_text(existing, &test_input()).unwrap();
        assert!(result.contains("[other_section]"));
        assert!(result.contains("codex-turn"));
        assert!(result.contains("model_providers"));
    }

    #[test]
    fn apply_invalid_toml_returns_error() {
        let existing = "this is not valid toml [[[";
        let result = apply_codex_turn_text(existing, &test_input());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse"));
    }

    #[test]
    fn doctor_output_parsing() {
        let output =
            "[OK] Node.js: v20.10.0\n[!!] Config: missing key\n[XX] Skills: not installed\n";
        let items = parse_doctor_output(output);
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].status, "pass");
        assert_eq!(items[0].name, "Node.js");
        assert_eq!(items[1].status, "warn");
        assert_eq!(items[1].name, "Config");
        assert_eq!(items[2].status, "fail");
        assert_eq!(items[2].name, "Skills");
    }

    #[test]
    fn proxy_url_parsing_ignores_path() {
        assert_eq!(
            parse_proxy_url("http://127.0.0.1:9090/v1"),
            Some(("127.0.0.1".to_string(), 9090))
        );
        assert_eq!(
            parse_proxy_url("http://localhost:8080"),
            Some(("localhost".to_string(), 8080))
        );
    }

    // --- Multi-provider tests ---

    #[test]
    fn multi_profile_non_overwrite() {
        // Apply first profile
        let result1 = apply_codex_turn_text("", &test_input()).unwrap();
        // Apply second profile to the result
        let result2 = apply_codex_turn_text(&result1, &test_input_alt()).unwrap();
        // Both profiles should coexist
        assert!(result2.contains("codex-turn"));
        assert!(result2.contains("my-profile"));
        assert!(result2.contains("my-provider"));
        // Original profile data should still be present
        assert!(result2.contains("http://127.0.0.1:9090/v1"));
        assert!(result2.contains("http://10.0.0.1:8080/v1"));
    }

    #[test]
    fn repeated_apply_no_duplicate_managed_blocks() {
        let input = CodexConfigInput {
            skills_toml: "[skills]\nfoo = \"bar\"".to_string(),
            ..test_input()
        };
        let result1 = apply_codex_turn_text("", &input).unwrap();
        let count1 = result1.matches("BEGIN CODEX TURN EXTRAS").count();
        assert_eq!(count1, 1);

        // Apply again — should still have exactly one managed block
        let result2 = apply_codex_turn_text(&result1, &input).unwrap();
        let count2 = result2.matches("BEGIN CODEX TURN EXTRAS").count();
        assert_eq!(count2, 1);
    }

    #[test]
    fn invalid_skills_toml_rejected() {
        let input = CodexConfigInput {
            skills_toml: "not valid [[[ toml".to_string(),
            ..test_input()
        };
        let result = apply_codex_turn_text("", &input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Skills TOML parse error"));
    }

    #[test]
    fn invalid_mcp_toml_rejected() {
        let input = CodexConfigInput {
            mcp_toml: "broken {{{".to_string(),
            ..test_input()
        };
        let result = apply_codex_turn_text("", &input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("MCP TOML parse error"));
    }

    #[test]
    fn invalid_plugins_toml_rejected() {
        let input = CodexConfigInput {
            plugins_toml: "bad ]]]".to_string(),
            ..test_input()
        };
        let result = apply_codex_turn_text("", &input);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Plugins TOML parse error"));
    }

    #[test]
    fn correct_provider_and_profile_ids() {
        let input = test_input_alt();
        let result = apply_codex_turn_text("", &input).unwrap();
        assert!(result.contains("my-provider"));
        assert!(result.contains("my-profile"));
        assert!(result.contains("My Provider"));
        assert!(result.contains("claude-sonnet-4-20250514"));
        assert!(!result.contains("env_key"));
    }

    #[test]
    fn managed_block_with_extras() {
        let input = CodexConfigInput {
            skills_toml: "[skills]\nfoo = \"bar\"".to_string(),
            mcp_toml: "[mcp]\nserver = \"test\"".to_string(),
            plugins_toml: "[plugins]\nplugin = \"demo\"".to_string(),
            ..test_input()
        };
        let result = apply_codex_turn_text("", &input).unwrap();
        assert!(result.contains("BEGIN CODEX TURN EXTRAS: codex-turn"));
        assert!(result.contains("END CODEX TURN EXTRAS: codex-turn"));
        assert!(result.contains("[skills]"));
        assert!(result.contains("[mcp]"));
        assert!(result.contains("[plugins]"));
    }

    #[test]
    fn managed_block_empty_extras_not_written() {
        let input = test_input(); // all TOML fields empty
        let result = apply_codex_turn_text("", &input).unwrap();
        assert!(!result.contains("BEGIN CODEX TURN EXTRAS"));
    }

    #[test]
    fn managed_block_different_profiles_independent() {
        // Each profile uses unique top-level table names to avoid TOML conflicts
        let input1 = CodexConfigInput {
            skills_toml: "[profile_skills]\nfoo = \"bar\"".to_string(),
            ..test_input()
        };
        let input2 = CodexConfigInput {
            skills_toml: "[other_skills]\nbaz = \"qux\"".to_string(),
            ..test_input_alt()
        };

        let result1 = apply_codex_turn_text("", &input1).unwrap();
        let result2 = apply_codex_turn_text(&result1, &input2).unwrap();

        // Both managed blocks should exist
        assert!(result2.contains("BEGIN CODEX TURN EXTRAS: codex-turn"));
        assert!(result2.contains("BEGIN CODEX TURN EXTRAS: my-profile"));
        assert!(result2.contains("foo"));
        assert!(result2.contains("baz"));
    }

    #[test]
    fn command_format_codex_p_profile_id() {
        let preview = preview_codex_config_sync(&test_input_alt());
        assert_eq!(preview.command, "codex -p my-profile");
    }

    fn preview_codex_config_sync(input: &CodexConfigInput) -> CodexPreview {
        let result = apply_codex_turn_text("", input).unwrap();
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let config_path = home.join(".codex/config.toml");
        CodexPreview {
            command: format!("codex -p {}", input.profile_id),
            config_path: config_path.to_string_lossy().to_string(),
            after: result,
        }
    }
}
