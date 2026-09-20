/** Agent Studio `studio-v2` wire types. Field names are the backend's JSON names. */

export type AgentMergeMode = 'append' | 'replace';
export type AgentResetScope = 'agent_override' | 'type_default' | 'platform_baseline';

export interface AgentSummary {
  agent_type: string;
  agent_name: string;
  display_name: string;
  purpose: string;
  enabled: boolean;
  is_default: boolean;
  readiness: string;
  readiness_reason: string;
  type_defaults_revision: number;
  agent_revision: number;
  published_version: number;
  published_at?: string;
  last_run_at?: string;
}

export interface AgentFieldError {
  field: string;
  message: string;
}

export interface AgentValidationProblem {
  message: string;
  fields: AgentFieldError[];
}

export interface AgentModelSelection {
  text_model: string;
  image_model: string;
  video_model: string;
}

export interface AgentApprovalPolicy {
  require_approval: boolean;
}

/** One contribution to a prompt section. `editable` is response-only. */
export interface AgentPromptLayer {
  scope_id: string;
  scope_kind: string;
  merge_mode: AgentMergeMode;
  sealed: boolean;
  editable: boolean;
  instruction: string;
  output: string;
}

export interface AgentPromptSection {
  prompt_header_id: number;
  caption: string;
  description: string;
  /** Widest scope first; the order is the server's and is never re-sorted. */
  layers: AgentPromptLayer[];
  effective_text: string;
  effective_output: string;
}

export interface AgentLanguageDraft {
  language_code: string;
  prompt_sections: AgentPromptSection[];
}

export interface AgentDrift {
  active_version: number;
  changed_languages: string[];
  causes: string[];
}

export interface AgentDraft {
  agent_type: string;
  agent_name: string;
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  approval_policy: AgentApprovalPolicy;
  models: AgentModelSelection;
  languages: AgentLanguageDraft[];
  agent_scope_id?: string;
  type_scope_id?: string;
  drift?: AgentDrift;
  expected_type_defaults_revision: number;
  expected_agent_revision: number;
}

export interface AgentTestRequest {
  agent_name: string;
  language_code: string;
  task: string;
  input_data: string;
}

export interface AgentTestResult {
  agent_name: string;
  language_code: string;
  model: string;
  digest: string;
  output: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  credits: number;
  sections: string[];
}

export interface AgentPublishRequest {
  agent_name: string;
  change_summary: string;
  expected_agent_revision: number;
  expected_type_defaults_revision: number;
}

export interface AgentRestoreRequest {
  agent_name: string;
  version: number;
}

/** `prompt_header_id` 0 and `language_code` '' leave that dimension unnarrowed. */
export interface AgentResetRequest {
  agent_name: string;
  scope: AgentResetScope;
  prompt_header_id: number;
  language_code: string;
  expected_agent_revision: number;
  expected_type_defaults_revision: number;
}

export interface AgentSetDefaultRequest {
  agent_name: string;
  expected_type_defaults_revision: number;
}

export interface AgentSetEnabledRequest {
  agent_name: string;
  enabled: boolean;
  expected_agent_revision: number;
}

export interface AgentEnabledState {
  enabled: boolean;
  expected_agent_revision: number;
}

export interface AgentRelease {
  agent_name: string;
  agent_type: string;
  version: number;
  enabled: boolean;
  models: AgentModelSelection;
  require_approval: boolean;
  definition_digest: string;
  change_summary: string;
  published_by: number;
  published_at: string;
  active: boolean;
  languages: string[];
}

export interface AgentAuditEvent {
  event: string;
  detail: string;
  user_id: number;
  event_time: string;
}

/** The layer that decided a section when its release was compiled. */
export interface AgentPromptSource {
  scope_id: string;
  scope_kind: string;
  merge_mode: AgentMergeMode;
  sealed: boolean;
}

export interface AgentReleaseSection {
  language_code: string;
  prompt_header_id: number;
  caption: string;
  description: string;
  instruction: string;
  output: string;
  sequence: number;
  source: AgentPromptSource;
}

export interface StudioModel {
  id: string;
  provider: string;
  model_type: string;
  display_name: string;
  input_credits_per_1k: number;
  output_credits_per_1k: number;
  image_credits: number;
  video_credits_per_sec: number;
}
