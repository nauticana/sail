import { Int64 } from '../../util/integer';

/**
 * Agent Studio wire types (Scout v1.2.20). Field names are the backend's JSON names; Go `int` and
 * `int64` fields are `Int64` strings, floats such as the credit rates stay numbers.
 */

/** R replace, A append, I intersect (non-prompt settings only). */
export type AgentMergeMode = 'R' | 'A' | 'I';
export type AgentResetScope = 'agent_override' | 'type_default' | 'platform_baseline';

export interface AgentSummary {
  agent_type: string;
  agent_name: string;
  display_name: string;
  purpose: string;
  enabled: boolean;
  is_default: boolean;
  archived: boolean;
  readiness: AgentReadiness;
  readiness_reason: string;
  type_defaults_revision: Int64;
  agent_revision: Int64;
  published_version: Int64;
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

/** One contribution to a prompt section. `editable` is response-only. */
export interface AgentPromptLayer {
  scope_id: string;
  scope_kind: string;
  merge_mode: AgentMergeMode;
  sealed: boolean;
  editable: boolean;
  instruction: string;
  output: string;
  /** Who last edited the layer; absent on the baseline. */
  bound_by?: Int64;
}

export interface AgentPromptSection {
  prompt_header_id: Int64;
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
  active_version: Int64;
  changed_languages: string[];
  causes: string[];
}

export interface AgentDraft {
  agent_type: string;
  agent_name: string;
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  models: AgentModelSelection;
  languages: AgentLanguageDraft[];
  agent_scope_id?: string;
  type_scope_id?: string;
  drift?: AgentDrift;
  expected_type_defaults_revision: Int64;
  expected_agent_revision: Int64;
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
  latency_ms: Int64;
  input_tokens: Int64;
  output_tokens: Int64;
  /** Cost in minor units. */
  credits: Int64;
  sections: string[];
}

export interface AgentPublishRequest {
  agent_name: string;
  change_summary: string;
  /** 1–99 deploys the release as a canary. */
  canary_percentage?: Int64;
  /** RFC 3339; a future time schedules the release. */
  effective_at?: string;
  expected_agent_revision: Int64;
  expected_type_defaults_revision: Int64;
}

export interface AgentRestoreRequest {
  agent_name: string;
  version: Int64;
}

/** `prompt_header_id` '0' and `language_code` '' leave that dimension unnarrowed. */
export interface AgentResetRequest {
  agent_name: string;
  scope: AgentResetScope;
  prompt_header_id: Int64;
  language_code: string;
  expected_agent_revision: Int64;
  expected_type_defaults_revision: Int64;
}

export interface AgentSetDefaultRequest {
  agent_name: string;
  expected_type_defaults_revision: Int64;
}

export interface AgentSetEnabledRequest {
  agent_name: string;
  enabled: boolean;
  reason?: string;
  expected_agent_revision: Int64;
}

export interface AgentEnabledState {
  enabled: boolean;
  expected_agent_revision: Int64;
}

export interface AgentRelease {
  agent_name: string;
  agent_type: string;
  version: Int64;
  enabled: boolean;
  models: AgentModelSelection;
  definition_digest: string;
  change_summary: string;
  published_by: Int64;
  published_at: string;
  active: boolean;
  languages: string[];
  activation?: ReleaseActivation;
}

/** A scheduled publish; state P pending, A activated, R refused, X cancelled. */
export interface ReleaseActivation {
  id: Int64;
  agent_name: string;
  version: Int64;
  definition_digest: string;
  canary_percentage?: Int64;
  effective_at: string;
  state: 'P' | 'A' | 'R' | 'X';
  scheduled_by: string;
  scheduled_at: string;
  attempts: Int64;
  next_attempt_at?: string;
  reason?: string;
  detail?: string;
  decided_by?: string;
  decided_at?: string;
}

export interface AgentAuditEvent {
  event: string;
  detail: string;
  actor_kind?: string;
  actor_id?: string;
  /** Set only when a person acted. */
  user_id?: Int64;
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
  prompt_header_id: Int64;
  caption: string;
  description: string;
  instruction: string;
  output: string;
  sequence: Int64;
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

/** One optional Studio API the backend mounted. Unknown ids are ignored; grants still decide. */
export interface StudioFeature {
  id: string;
  version: Int64;
  actions: string[];
  /** Authorization object of the actions; empty is AGENT_STUDIO. */
  object?: string;
}

/** `copy_from` and `template_id` are exclusive. */
export interface AgentCreateRequest {
  agent_type: string;
  display_name: string;
  copy_from?: string;
  template_id?: string;
  template_version?: Int64;
  references?: Record<string, Record<string, string>>;
  idempotency_key: string;
}

export interface AgentRenameRequest {
  agent_name: string;
  display_name: string;
  expected_agent_revision: Int64;
}

export interface AgentArchiveRequest {
  agent_name: string;
  expected_agent_revision: Int64;
}

export interface AgentSettingSource {
  scope_id: string;
  scope_kind: string;
  resource_version: string;
  merge_mode: AgentMergeMode;
  sealed: boolean;
}

/** One binding on the agent's scope chain; `editable` marks the agent's and its type's scopes. */
export interface AgentSetting {
  scope_id: string;
  scope_kind: string;
  editable: boolean;
  resource_kind: string;
  resource_id: string;
  resource_version: string;
  merge_mode: AgentMergeMode;
  sealed: boolean;
  value: unknown;
}

export interface AgentEffectiveSetting {
  resource_kind: string;
  resource_id: string;
  value: unknown;
  source: AgentSettingSource;
  superseded?: AgentSettingSource[];
}

/** Bindings other than prompt sections; `problem` says why they do not compile. */
export interface AgentSettings {
  agent_name: string;
  agent_scope_id: string;
  type_scope_id: string;
  bindings: AgentSetting[];
  effective: AgentEffectiveSetting[];
  problem?: string;
  expected_agent_revision: Int64;
  expected_type_defaults_revision: Int64;
}

/** Binds, or with `remove` ends, one resource at the agent or type scope. */
export interface AgentSettingChange {
  agent_name: string;
  scope_id: string;
  resource_kind: string;
  resource_id: string;
  merge_mode?: AgentMergeMode;
  sealed: boolean;
  value?: unknown;
  remove: boolean;
  expected_agent_revision: Int64;
  expected_type_defaults_revision: Int64;
}

/** Scout's fixed `AgentReadiness` values, which no constant domain carries. */
export type AgentReadiness =
  'ready' | 'disabled' | 'missing_model' | 'unpublished' | 'error' | 'not_entitled' | 'needs_integration' | 'forbidden';

export const AGENT_READINESS_CAPTIONS: Record<AgentReadiness, string> = {
  ready: 'Ready',
  disabled: 'Disabled',
  missing_model: 'No text model',
  unpublished: 'Unpublished',
  error: 'Invalid definition',
  not_entitled: 'Not entitled',
  needs_integration: 'Needs integration',
  forbidden: 'Forbidden',
};

/** One enforced guardrail rule; `params` is the kind's JSON parameters. */
export interface GuardrailRule {
  id: string;
  kind: string;
  stages?: string[];
  action: string;
  severity: string;
  params?: unknown;
  /** Why the rule exists; a blocked answer names it. */
  reason?: string;
}

/** Rules an agent inherits from one layer: B baseline, P platform, T tenant, Y type. */
export interface InheritedGuardrails {
  layer: string;
  digest?: string;
  rules: GuardrailRule[];
}

/** The layers an agent inherits, widest first, and its own rules, which only add or tighten. */
export interface AgentGuardrails {
  agent_name: string;
  inherited: InheritedGuardrails[];
  rules: GuardrailRule[];
  /** Why the agent's rules no longer fit the inherited ones. */
  problem?: string;
  expected_agent_revision: Int64;
}

/** Replaces the agent's own rules as a whole; an empty list removes them. */
export interface AgentGuardrailChange {
  agent_name: string;
  rules: GuardrailRule[];
  expected_agent_revision: Int64;
}

/** One stored guardrail hit: rule ids and attribution, never the inspected content. */
export interface SafetyEvent {
  id: Int64;
  version?: string;
  policy_version?: string;
  stage: string;
  layer: string;
  action: string;
  severity: string;
  rule_ids: string[];
  actor_kind?: string;
  actor_id?: string;
  request_id?: string;
  duration_ms: Int64;
  occurred_at: string;
}
