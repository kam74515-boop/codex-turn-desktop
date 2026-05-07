# Codex Turn

> **Codex CLI 本地中转桌面应用 / Local proxy gateway for Codex CLI**
>
> 让 Codex CLI 接入仅支持 Chat Completions 格式的国产模型服务（DeepSeek、智谱、Kimi、腾讯、MiniMax、小米等）。
>
> Enables Codex CLI to work with model providers that only support the OpenAI Chat Completions format (DeepSeek, Zhipu GLM, Kimi, Tencent, MiniMax, Xiaomi, etc.).

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)
![Node](https://img.shields.io/badge/Node-%3E%3D20-green)

---

## 目录 / Table of Contents

- [工作原理 / How It Works](#工作原理--how-it-works)
- [能力边界 / Capability Boundary](#能力边界--capability-boundary)
- [支持的模型供应商 / Supported Providers](#支持的模型供应商--supported-providers)
- [快速安装 / Quick Install](#快速安装--quick-install)
- [配置教程 / Configuration Guide](#配置教程--configuration-guide)
- [桌面应用功能 / Desktop App Features](#桌面应用功能--desktop-app-features)
- [Codex CLI 配置 / Codex CLI Configuration](#codex-cli-配置--codex-cli-configuration)
- [环境变量 / Environment Variables](#环境变量--environment-variables)
- [项目架构 / Architecture](#项目架构--architecture)
- [技术栈 / Tech Stack](#技术栈--tech-stack)
- [开发指南 / Development Guide](#开发指南--development-guide)
- [常见问题 / FAQ](#常见问题--faq)
- [开源许可 / License](#开源许可--license)

---

## 工作原理 / How It Works

### 中文

Codex CLI 官方使用 OpenAI 的 Responses API 协议。国内大部分模型厂商（DeepSeek、智谱、Kimi 等）仅支持 Chat Completions 格式，无法直接对接。

Codex Turn 在本机启动一个轻量代理服务器，将 Codex CLI 发出的 Responses API 请求实时转换为 Chat Completions 请求，发送给上游模型服务，再将响应转换回 Responses 格式返回给 Codex CLI。

**核心路径：**

```text
codex -p codex-turn
  -> http://127.0.0.1:9090/v1/responses        (Codex CLI 发出 Responses 请求)
  -> Codex Turn 协议转换器                       (Responses <-> Chat Completions 双向转换)
  -> {provider}/v1/chat/completions              (上游模型服务收到 Chat Completions 请求)
```

支持两种上游模式：

| 模式 | 说明 |
|------|------|
| `responses`（默认） | 上游支持 Responses API，Codex Turn 做透传转换 |
| `completions` | 上游仅支持 Chat Completions，Codex Turn 做双向协议转换 |

### English

Codex CLI uses OpenAI's Responses API protocol. Most Chinese model providers (DeepSeek, Zhipu, Kimi, etc.) only support the Chat Completions format, making direct integration impossible.

Codex Turn runs a lightweight local proxy server that converts Responses API requests from Codex CLI into Chat Completions requests in real time, forwards them to the upstream model service, and converts the responses back to the Responses format.

**Core flow:**

```text
codex -p codex-turn
  -> http://127.0.0.1:9090/v1/responses        (Codex CLI sends Responses request)
  -> Codex Turn protocol converter               (Responses <-> Chat Completions bidirectional conversion)
  -> {provider}/v1/chat/completions              (Upstream receives Chat Completions request)
```

Two upstream modes are supported:

| Mode | Description |
|------|-------------|
| `responses` (default) | Upstream supports Responses API; Codex Turn acts as a pass-through converter |
| `completions` | Upstream only supports Chat Completions; Codex Turn performs full bidirectional protocol conversion |

---

## 能力边界 / Capability Boundary

### 中文

| 能力 | 状态 | 说明 |
|------|------|------|
| 文本对话请求转换 | ✅ 已实现 | `/v1/responses` <-> `/v1/chat/completions` |
| 流式响应（SSE） | ✅ 已实现 | 支持 `response.output_text.delta` 等事件流 |
| 工具调用 / Function Calling | ✅ 已实现 | `tools`、`tool_choice`、`function_call` 双向映射 |
| 推理参数映射 | ✅ 已实现 | `reasoning_effort` <-> `reasoning.effort` |
| 多轮对话上下文 | ✅ 已实现 | `instructions` <-> `system` message 映射 |
| 响应格式约束 | ✅ 已实现 | `response_format` <-> `text.format` 映射 |
| 图片识别 / 视觉输入 | ❌ 未实现 | `image_url` 内容类型已定义但未做完整转接 |
| 联网搜索 / Web Search | ❌ 未实现 | 上游内置工具能力无法透传 |
| 代码解释器 | ❌ 未实现 | 上游内置工具能力无法透传 |

### English

| Capability | Status | Description |
|------------|--------|-------------|
| Text conversation conversion | ✅ Done | `/v1/responses` <-> `/v1/chat/completions` |
| Streaming responses (SSE) | ✅ Done | Supports `response.output_text.delta` and other event streams |
| Tool calls / Function Calling | ✅ Done | Bidirectional mapping of `tools`, `tool_choice`, `function_call` |
| Reasoning parameter mapping | ✅ Done | `reasoning_effort` <-> `reasoning.effort` |
| Multi-turn conversation context | ✅ Done | `instructions` <-> `system` message mapping |
| Response format constraints | ✅ Done | `response_format` <-> `text.format` mapping |
| Image recognition / Vision | ❌ Not yet | `image_url` content types are defined but not fully bridged |
| Web Search | ❌ Not yet | Upstream built-in tool capabilities cannot be proxied |
| Code Interpreter | ❌ Not yet | Upstream built-in tool capabilities cannot be proxied |

---

## 支持的模型供应商 / Supported Providers

### 中文

Codex Turn 兼容所有支持 OpenAI Chat Completions 格式的 API 服务。以下为已验证的供应商：

| 供应商 | API Base URL 示例 | 备注 |
|--------|-------------------|------|
| **DeepSeek** | `https://api.deepseek.com` | deepseek-v4-flash / deepseek-v4-pro |
| **智谱 AI (GLM)** | `https://open.bigmodel.cn/api/paas/v4` | GLM-5.1 / GLM-4-Plus |
| **月之暗面 (Kimi)** | `https://api.moonshot.cn/v1` | kimi-k2.6 |
| **腾讯混元** | `https://api.hunyuan.cloud.tencent.com/v1` | HY 2.0 Think / Instruct |
| **MiniMax** | `https://api.minimax.chat/v1` | MiniMax-M2.7 / M2.5 |
| **小米 MiMo** | `https://token-plan-cn.xiaomimimo.com/v1` | mimo-v2.5-pro / mimo-v2.5-flash |
| **阿里云百炼 (Qwen)** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen3-max / qwen3.5-plus |
| **字节豆包 (火山引擎)** | `https://ark.cn-beijing.volces.com/api/v3` | Seed-2.0-Pro / Seed-2.0-Code |

> **注意：** 阿里云百炼和字节火山引擎已原生支持 Responses API，可直接通过 Codex CLI 对接，无需 Codex Turn 转换。其余供应商仅支持 Chat Completions，需要 Codex Turn 做协议转换。

### English

Codex Turn is compatible with all API services that support the OpenAI Chat Completions format. Verified providers:

| Provider | API Base URL Example | Notes |
|----------|---------------------|-------|
| **DeepSeek** | `https://api.deepseek.com` | deepseek-v4-flash / deepseek-v4-pro |
| **Zhipu AI (GLM)** | `https://open.bigmodel.cn/api/paas/v4` | GLM-5.1 / GLM-4-Plus |
| **Moonshot (Kimi)** | `https://api.moonshot.cn/v1` | kimi-k2.6 |
| **Tencent Hunyuan** | `https://api.hunyuan.cloud.tencent.com/v1` | HY 2.0 Think / Instruct |
| **MiniMax** | `https://api.minimax.chat/v1` | MiniMax-M2.7 / M2.5 |
| **Xiaomi MiMo** | `https://token-plan-cn.xiaomimimo.com/v1` | mimo-v2.5-pro / mimo-v2.5-flash |
| **Alibaba Bailian (Qwen)** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen3-max / qwen3.5-plus |
| **ByteDance Doubao (Volcengine)** | `https://ark.cn-beijing.volces.com/api/v3` | Seed-2.0-Pro / Seed-2.0-Code |

> **Note:** Alibaba Bailian and ByteDance Volcengine natively support the Responses API and can be used directly with Codex CLI without Codex Turn. The other providers only support Chat Completions and require Codex Turn for protocol conversion.

---

## 快速安装 / Quick Install

### 中文

从 [GitHub Releases](https://github.com/kam74515-boop/codex-turn-desktop/releases/latest) 下载对应系统安装包。

| 系统 | 安装包格式 |
|------|-----------|
| macOS | `.dmg` |
| Windows | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` |

也可以用 GitHub CLI 快速下载最新版：

```bash
# macOS
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.dmg" --clobber
open *.dmg

# Windows PowerShell
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.msi" --clobber

# Linux
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.AppImage" --clobber
chmod +x *.AppImage
./*.AppImage
```

### English

Download the installer for your OS from [GitHub Releases](https://github.com/kam74515-boop/codex-turn-desktop/releases/latest).

| Platform | Installer Format |
|----------|-----------------|
| macOS | `.dmg` |
| Windows | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` |

Or use GitHub CLI for quick download:

```bash
# macOS
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.dmg" --clobber
open *.dmg

# Windows PowerShell
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.msi" --clobber

# Linux
gh release download --repo kam74515-boop/codex-turn-desktop --pattern "*.AppImage" --clobber
chmod +x *.AppImage
./*.AppImage
```

---

## 配置教程 / Configuration Guide

### 中文

#### 第一步：启动 Codex Turn

安装并打开 Codex Turn 桌面应用。

#### 第二步：配置供应商

进入 **"供应商和代理"** 页面，点击 "新增配置"，填写以下信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| **配置名称** | 自定义标识，便于管理 | `DeepSeek V4` |
| **供应商 ID** | 配置的唯一标识（自动生成） | `deepseek-v4` |
| **Profile ID** | Codex CLI profile 名称 | `codex-turn` |
| **API Base URL** | 上游模型服务地址 | `https://api.deepseek.com` |
| **API Key** | 模型服务的 API Key | `sk-...` |
| **Model** | 模型 ID，**必须与上游 `/v1/models` 返回的大小写完全一致** | `deepseek-v4-flash` |
| **Host** | 本地代理监听地址 | `127.0.0.1` |
| **Port** | 本地代理监听端口 | `9090` |
| **Skills TOML** | 可选，oh-my-codex skills 配置 | — |
| **MCP TOML** | 可选，MCP server 配置 | — |
| **Plugins TOML** | 可选，插件配置 | — |

> **重要：** Model 字段的大小写必须与上游服务返回的模型 ID 完全一致。可通过 `curl http://127.0.0.1:9090/v1/models` 查询。

#### 第三步：启动代理

点击 **"启动代理"** 按钮。Codex Turn 会：

1. 在 `127.0.0.1:9090` 启动本地代理服务
2. 自动写入 `~/.codex/config.toml`，生成 `codex-turn` profile
3. 显示代理运行状态

#### 第四步：使用 Codex CLI

打开新终端运行：

```bash
codex -p codex-turn
```

#### 代理绕过设置

如果你的终端设置了系统代理，建议给本机地址加绕过规则：

```bash
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="$NO_PROXY"
```

#### 健康检查

```bash
curl --noproxy "*" http://127.0.0.1:9090/health
```

正常输出：`{"status":"ok"}`

---

### English

#### Step 1: Launch Codex Turn

Install and open the Codex Turn desktop app.

#### Step 2: Configure Provider

Go to the **"Provider & Proxy"** page and click "Add Configuration":

| Field | Description | Example |
|-------|-------------|---------|
| **Configuration Name** | Custom label for easy management | `DeepSeek V4` |
| **Provider ID** | Unique identifier (auto-generated) | `deepseek-v4` |
| **Profile ID** | Codex CLI profile name | `codex-turn` |
| **API Base URL** | Upstream model service URL | `https://api.deepseek.com` |
| **API Key** | Model service API key | `sk-...` |
| **Model** | Model ID — **must match the upstream `/v1/models` response exactly (case-sensitive)** | `deepseek-v4-flash` |
| **Host** | Local proxy listen address | `127.0.0.1` |
| **Port** | Local proxy listen port | `9090` |
| **Skills TOML** | Optional, oh-my-codex skills config | — |
| **MCP TOML** | Optional, MCP server config | — |
| **Plugins TOML** | Optional, plugins config | — |

> **Important:** The Model field must exactly match the model ID returned by the upstream service (case-sensitive). Use `curl http://127.0.0.1:9090/v1/models` to check available models.

#### Step 3: Start Proxy

Click the **"Start Proxy"** button. Codex Turn will:

1. Start the local proxy on `127.0.0.1:9090`
2. Automatically write a `codex-turn` profile to `~/.codex/config.toml`
3. Display the proxy running status

#### Step 4: Use Codex CLI

Open a new terminal and run:

```bash
codex -p codex-turn
```

#### Proxy Bypass

If your terminal has a system proxy configured, add bypass rules for localhost:

```bash
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="$NO_PROXY"
```

#### Health Check

```bash
curl --noproxy "*" http://127.0.0.1:9090/health
```

Expected output: `{"status":"ok"}`

---

## 桌面应用功能 / Desktop App Features

### 中文

Codex Turn 桌面应用基于 Tauri v2 构建，提供六个功能页面：

#### 1. 仪表盘 (Dashboard)
- 代理运行状态总览
- Codex CLI 配置状态检查
- oh-my-codex 安装状态
- 本地 API 健康状态

#### 2. 供应商和代理 (Provider & Proxy)
- 多供应商配置管理（增删改查）
- 代理启动 / 停止 / 健康检查
- 支持 skills.toml / mcp.toml / plugins.toml 高级配置
- 配置数据持久化至 localStorage

#### 3. Codex 配置 (Codex Config)
- 预览 config.toml 变更
- 一键应用配置（自动备份原文件）
- 恢复默认配置
- 支持 managed extras block，安全注入自定义配置段

#### 4. Oh My Codex (OMX)
- 一键安装 / 更新 oh-my-codex
- 健康检查 (doctor)
- Skills 目录浏览
- 命令执行器
- HUD 状态面板

#### 5. 终端 (Terminal)
- 内置 Shell 终端
- 支持命令执行和输出查看
- 基于 `/bin/zsh -lc` 的安全命令执行

#### 6. 历史记录 (History)
- 浏览 Codex CLI 对话历史
- 读取 `~/.codex/` 下的 `.jsonl` 对话文件
- 按修改时间排序，最多显示 120 条

### English

The Codex Turn desktop app is built with Tauri v2 and provides six functional pages:

#### 1. Dashboard
- Proxy running status overview
- Codex CLI configuration status check
- oh-my-codex installation status
- Local API health status

#### 2. Provider & Proxy
- Multi-provider configuration management (CRUD)
- Proxy start / stop / health check
- Supports skills.toml / mcp.toml / plugins.toml advanced configuration
- Configuration data persisted to localStorage

#### 3. Codex Config
- Preview config.toml changes
- One-click configuration apply (auto-backup)
- Restore default configuration
- Managed extras blocks for safe custom config injection

#### 4. Oh My Codex (OMX)
- One-click install / update oh-my-codex
- Health check (doctor)
- Skills catalog browsing
- Command executor
- HUD status panel

#### 5. Terminal
- Built-in shell terminal
- Command execution with output viewing
- Safe command execution via `/bin/zsh -lc`

#### 6. History
- Browse Codex CLI conversation history
- Read `.jsonl` conversation files from `~/.codex/`
- Sorted by modification time, up to 120 entries

---

## Codex CLI 配置 / Codex CLI Configuration

### 中文

Codex Turn 会自动写入 `~/.codex/config.toml`，生成如下配置：

```toml
[model_providers.codex-turn]
name = "Codex Turn"
base_url = "http://127.0.0.1:9090/v1"
wire_api = "responses"

[profiles.codex-turn]
model_provider = "codex-turn"
model = "mimo-v2.5-pro"
```

启动命令：

```bash
codex -p codex-turn
```

可以自定义 `providerId` 和 `profileId`，实现多供应商切换：

```bash
# 使用 DeepSeek 配置
codex -p codex-turn-deepseek

# 使用小米 MiMo 配置
codex -p codex-turn-mimo
```

### English

Codex Turn automatically writes a `codex-turn` profile to `~/.codex/config.toml`:

```toml
[model_providers.codex-turn]
name = "Codex Turn"
base_url = "http://127.0.0.1:9090/v1"
wire_api = "responses"

[profiles.codex-turn]
model_provider = "codex-turn"
model = "mimo-v2.5-pro"
```

Launch command:

```bash
codex -p codex-turn
```

You can customize `providerId` and `profileId` for multi-provider switching:

```bash
# Use DeepSeek config
codex -p codex-turn-deepseek

# Use Xiaomi MiMo config
codex -p codex-turn-mimo
```

---

## 环境变量 / Environment Variables

### 中文

`@codex-turn/converter` 支持通过环境变量或 CLI 参数配置：

| 环境变量 | CLI 参数 | 说明 | 默认值 |
|----------|----------|------|--------|
| `RESPONSES_API_BASE_URL` | `--responses-url` | 上游 Responses API 地址 | `https://api.openai.com` |
| `RESPONSES_API_KEY` | `--responses-key` | Responses API Key | — |
| `COMPLETIONS_API_BASE_URL` | `--completions-url` | 上游 Chat Completions 地址 | 同 Responses URL |
| `COMPLETIONS_API_KEY` | `--completions-key` | Chat Completions API Key | 同 Responses Key |
| `HOST` | `--host` | 代理监听地址 | `127.0.0.1` |
| `PORT` | `--port` | 代理监听端口 | `9090` |
| `CHAT_UPSTREAM` | `--chat-upstream` | 上游模式：`responses` 或 `completions` | `responses` |

独立运行转换器（无需桌面应用）：

```bash
COMPLETIONS_API_BASE_URL=https://api.deepseek.com \
COMPLETIONS_API_KEY=sk-xxx \
npx codex-turn-converter
```

### English

`@codex-turn/converter` supports configuration via environment variables or CLI arguments:

| Env Variable | CLI Arg | Description | Default |
|-------------|---------|-------------|---------|
| `RESPONSES_API_BASE_URL` | `--responses-url` | Upstream Responses API URL | `https://api.openai.com` |
| `RESPONSES_API_KEY` | `--responses-key` | Responses API Key | — |
| `COMPLETIONS_API_BASE_URL` | `--completions-url` | Upstream Chat Completions URL | Same as Responses URL |
| `COMPLETIONS_API_KEY` | `--completions-key` | Chat Completions API Key | Same as Responses Key |
| `HOST` | `--host` | Proxy listen address | `127.0.0.1` |
| `PORT` | `--port` | Proxy listen port | `9090` |
| `CHAT_UPSTREAM` | `--chat-upstream` | Upstream mode: `responses` or `completions` | `responses` |

Run the converter standalone (without the desktop app):

```bash
COMPLETIONS_API_BASE_URL=https://api.deepseek.com \
COMPLETIONS_API_KEY=sk-xxx \
npx codex-turn-converter
```

---

## 项目架构 / Architecture

### 中文

```text
codex-turn-desktop/
├── apps/
│   └── desktop/                Tauri v2 + React 19 桌面应用
│       ├── src/                React 前端（6 个页面 + i18n + hooks）
│       └── src-tauri/          Rust 后端（17 个 Tauri 命令）
├── packages/
│   ├── converter/              协议转换器核心库（零运行时依赖）
│   │   ├── src/convert/        请求/响应双向转换逻辑
│   │   ├── src/stream/         SSE 流式响应转换
│   │   ├── src/types/          Chat Completions & Responses 类型定义
│   │   └── src/server.ts       HTTP 代理服务器
│   ├── codex-config/           Codex CLI config.toml 操作库
│   └── omx-bridge/             oh-my-codex 进程桥接
├── vendor/
│   └── oh-my-codex/            内置的 oh-my-codex v0.16.0
└── Sources/CodexTurn/          预留的原生 Swift 模块（暂为空）
```

### 请求处理流程 / Request Flow:

```text
Codex CLI                   Codex Turn Desktop                  上游模型服务
   │                              │                                  │
   │  POST /v1/responses          │                                  │
   │ ─────────────────────────>   │                                  │
   │                              │  responsesToChatCompletionRequest()
   │                              │  (Responses -> Chat Completions)  │
   │                              │                                  │
   │                              │  POST /v1/chat/completions       │
   │                              │ ───────────────────────────────>  │
   │                              │                                  │
   │                              │  <─── SSE stream / JSON ───────  │
   │                              │                                  │
   │                              │  chatCompletionToResponses()
   │                              │  (Chat Completions -> Responses)  │
   │                              │                                  │
   │  <─── SSE stream / JSON ──   │                                  │
   │                              │                                  │
```

### English

```text
codex-turn-desktop/
├── apps/
│   └── desktop/                Tauri v2 + React 19 desktop app
│       ├── src/                React frontend (6 pages + i18n + hooks)
│       └── src-tauri/          Rust backend (17 Tauri commands)
├── packages/
│   ├── converter/              Protocol converter core library (zero runtime deps)
│   │   ├── src/convert/        Request/response bidirectional conversion logic
│   │   ├── src/stream/         SSE streaming response conversion
│   │   ├── src/types/          Chat Completions & Responses type definitions
│   │   └── src/server.ts       HTTP proxy server
│   ├── codex-config/           Codex CLI config.toml manipulation library
│   └── omx-bridge/             oh-my-codex process bridge
├── vendor/
│   └── oh-my-codex/            Bundled oh-my-codex v0.16.0
└── Sources/CodexTurn/          Reserved native Swift module (currently empty)
```

### Request Flow:

```text
Codex CLI                   Codex Turn Desktop                  Upstream Model Service
   │                              │                                  │
   │  POST /v1/responses          │                                  │
   │ ─────────────────────────>   │                                  │
   │                              │  responsesToChatCompletionRequest()
   │                              │  (Responses -> Chat Completions)  │
   │                              │                                  │
   │                              │  POST /v1/chat/completions       │
   │                              │ ───────────────────────────────>  │
   │                              │                                  │
   │                              │  <─── SSE stream / JSON ───────  │
   │                              │                                  │
   │                              │  chatCompletionToResponses()
   │                              │  (Chat Completions -> Responses)  │
   │                              │                                  │
   │  <─── SSE stream / JSON ──   │                                  │
   │                              │                                  │
```

---

## 技术栈 / Tech Stack

| 层级 / Layer | 技术 / Technology |
|-------------|-------------------|
| 桌面框架 / Desktop Framework | Tauri v2 |
| 前端 / Frontend | React 19, Vite 7, TypeScript |
| 后端 / Backend (desktop) | Rust (toml_edit, ureq, dirs, chrono) |
| 协议转换 / Protocol Converter | TypeScript (Node.js >= 20, zero runtime deps) |
| 配置工具 / Config Tool | TypeScript + @iarna/toml |
| OMX 桥接 / OMX Bridge | TypeScript (child_process spawn) |
| 构建 / Build | npm workspaces, TypeScript, Cargo |
| CI/CD | GitHub Actions (macOS / Windows / Linux 三平台矩阵构建) |
| 国际化 / i18n | 中文 (zh) + English (en), React Context |
| 内置工具 / Bundled Tool | oh-my-codex v0.16.0 (vendored) |

---

## 开发指南 / Development Guide

### 中文

#### 环境要求

- Node.js >= 20
- Rust (stable)
- npm

#### 常用命令

```bash
# 安装依赖
npm install

# 构建所有工作区
npm run build

# 运行所有测试
npm run test

# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 完整 CI 流程（构建 + 测试 + Rust 测试）
npm run ci

# 开发模式：仅运行转换器
npm run dev:converter

# 开发模式：运行桌面应用（Tauri dev）
npm run dev:desktop

# 构建当前系统安装包
npm --workspace @codex-turn/desktop run tauri:build

# 清理所有构建产物
npm run clean
```

#### 工作区说明

| 包名 | 说明 |
|------|------|
| `@codex-turn/converter` | 协议转换核心库，可独立使用 |
| `@codex-turn/desktop` | Tauri 桌面应用 |
| `@codex-turn/codex-config` | Codex CLI 配置操作库 |
| `@codex-turn/omx-bridge` | oh-my-codex 桥接库 |

### English

#### Requirements

- Node.js >= 20
- Rust (stable)
- npm

#### Common Commands

```bash
# Install dependencies
npm install

# Build all workspaces
npm run build

# Run all tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck

# Full CI pipeline (build + test + Cargo test)
npm run ci

# Dev mode: run converter only
npm run dev:converter

# Dev mode: run desktop app (Tauri dev)
npm run dev:desktop

# Build installer for current platform
npm --workspace @codex-turn/desktop run tauri:build

# Clean all build artifacts
npm run clean
```

#### Workspace Packages

| Package | Description |
|---------|-------------|
| `@codex-turn/converter` | Protocol conversion core library, usable standalone |
| `@codex-turn/desktop` | Tauri desktop application |
| `@codex-turn/codex-config` | Codex CLI config manipulation library |
| `@codex-turn/omx-bridge` | oh-my-codex bridge library |

---

## 常见问题 / FAQ

### `Not supported model ...`

**中文：** 模型名不被上游支持，通常是大小写或模型 ID 写错。先查询：

```bash
curl --noproxy "*" http://127.0.0.1:9090/v1/models
```

把返回的 `id` 原样填到 Model 字段。

**English:** The model name is not supported by the upstream service. Usually a case-sensitivity or typo issue. Check available models:

```bash
curl --noproxy "*" http://127.0.0.1:9090/v1/models
```

Copy the `id` value directly into the Model field.

---

### `502 Bad Gateway` 或请求去了其他代理

**中文：** 终端的 `HTTP_PROXY` 可能拦截了本机请求。执行：

```bash
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="$NO_PROXY"
```

**English:** The terminal's `HTTP_PROXY` may be intercepting localhost requests. Run:

```bash
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="$NO_PROXY"
```

---

### `404 Not Found openresty`

**中文：** 一般是上游 URL 拼接问题或上游接口路径不对。Codex Turn 支持两种写法：

```text
https://example.com
https://example.com/v1
```

两者都会正确请求到 `/v1/chat/completions`。

**English:** Usually caused by upstream URL concatenation or incorrect API path. Codex Turn supports both formats:

```text
https://example.com
https://example.com/v1
```

Both will correctly resolve to `/v1/chat/completions`.

---

### 如何切换不同供应商？/ How to switch providers?

**中文：** 在桌面应用的 "供应商和代理" 页面创建多个配置，每个配置使用不同的 `providerId` 和 `profileId`。启动不同配置后，使用对应的 profile 名称运行 Codex CLI：

```bash
codex -p codex-turn-deepseek
codex -p codex-turn-mimo
```

**English:** Create multiple configurations in the "Provider & Proxy" page with different `providerId` and `profileId` values. After starting a configuration, use the corresponding profile name:

```bash
codex -p codex-turn-deepseek
codex -p codex-turn-mimo
```

---

### 可以不用桌面应用吗？/ Can I use it without the desktop app?

**中文：** 可以。`@codex-turn/converter` 可以独立运行：

```bash
COMPLETIONS_API_BASE_URL=https://api.deepseek.com \
COMPLETIONS_API_KEY=sk-xxx \
npx codex-turn-converter
```

**English:** Yes. `@codex-turn/converter` can run standalone:

```bash
COMPLETIONS_API_BASE_URL=https://api.deepseek.com \
COMPLETIONS_API_KEY=sk-xxx \
npx codex-turn-converter
```

---

## 开源许可 / License

MIT License. See [LICENSE](LICENSE).
