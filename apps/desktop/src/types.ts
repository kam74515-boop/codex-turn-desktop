// ===== 代理相关 =====

export type ProxyStatus = {
  running: boolean;
  healthy: boolean;
  url: string;
  message: string;
};

export type ProxySettings = {
  responsesUrl: string;
  apiKey: string;
  completionsUrl: string;
  completionsKey: string;
  host: string;
  port: number;
};

// ===== Codex 配置相关 =====

export type CodexPreview = {
  command: string;
  configPath: string;
  after: string;
};

export type CodexConfigStatus = {
  configPath: string;
  exists: boolean;
  hasCodexTurn: boolean;
  model?: string;
  baseUrl?: string;
};

// ===== OMX 相关 =====

export type OmxStatus = {
  vendorRoot: string;
  commit?: string;
  ready: boolean;
};

export type OmxCommandResult = {
  command: string;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type OmxUpdateInfo = {
  currentCommit: string;
  latestCommit: string;
  behind: number;
  updateAvailable: boolean;
  latestDate: string;
  latestMessage: string;
};

export type OmxDoctorItem = {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

export type OmxPrerequisites = {
  git: boolean;
  node: boolean;
  npm: boolean;
  allMet: boolean;
};

export type OmxCatalogSkill = {
  name: string;
  description: string;
  category: "execution" | "planning" | "shortcut" | "utility";
  status: "active" | "alias" | "merged" | "deprecated" | "internal";
  canonical?: string;
  core?: boolean;
};

export type OmxCatalogAgent = {
  name: string;
  description: string;
  category: string;
  reasoningEffort?: string;
  modelClass?: string;
};

export type OmxCatalog = {
  generatedAt: string;
  version: string;
  counts: {
    skillCount: number;
    promptCount: number;
    activeSkillCount: number;
    activeAgentCount: number;
  };
  coreSkills: string[];
  skills: OmxCatalogSkill[];
  agents: OmxCatalogAgent[];
};

export type OmxWorkflowMode = {
  active: boolean;
  currentPhase?: string;
  iteration?: number;
  sessionId?: string;
};

export type OmxHudMetrics = {
  totalTurns?: number;
  sessionTurns?: number;
  lastActivity?: string;
  sessionInputTokens?: number;
  sessionOutputTokens?: number;
  sessionTotalTokens?: number;
  fiveHourLimitPct?: number;
  weeklyLimitPct?: number;
};

export type OmxHud = {
  version?: string;
  gitBranch?: string;
  ralph?: OmxWorkflowMode & { maxIterations?: number };
  ultrawork?: OmxWorkflowMode & { reinforcementCount?: number };
  autopilot?: OmxWorkflowMode;
  ralplan?: OmxWorkflowMode & { planningComplete?: boolean };
  deepInterview?: OmxWorkflowMode & { inputLockActive?: boolean };
  autoresearch?: OmxWorkflowMode;
  ultraqa?: OmxWorkflowMode;
  team?: OmxWorkflowMode & { agentCount?: number; teamName?: string };
  metrics?: OmxHudMetrics;
  session?: { sessionId?: string; startedAt?: string };
};

// ===== 终端 =====

export type TerminalCommandResult = {
  command: string;
  cwd: string;
  code: number | null;
  stdout: string;
  stderr: string;
};

export type TerminalEntry = TerminalCommandResult & {
  id: string;
  createdAt: string;
};

// ===== 历史会话 =====

export type ConversationSummary = {
  path: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
};

export type ConversationDetail = {
  path: string;
  content: string;
};

// ===== 供应商配置 =====

export type ProviderConfig = {
  id: string;
  name: string;
  providerId: string;
  profileId: string;
  responsesUrl: string;
  apiKey: string;
  completionsUrl: string;
  completionsKey: string;
  model: string;
  host: string;
  port: string;
  skillsToml: string;
  mcpToml: string;
  pluginsToml: string;
};

// ===== 页面 =====

export type PageId =
  | "dashboard"
  | "provider"
  | "codex"
  | "omx"
  | "terminal"
  | "history";
