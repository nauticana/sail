import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../service/base_rest.service';
import {
  AgentArchiveRequest,
  AgentGuardrailChange,
  AgentGuardrails,
  AgentAuditEvent,
  AgentCreateRequest,
  AgentDraft,
  AgentEnabledState,
  AgentPublishRequest,
  AgentRelease,
  AgentReleaseSection,
  AgentRenameRequest,
  AgentResetRequest,
  AgentRestoreRequest,
  AgentSetDefaultRequest,
  AgentSetEnabledRequest,
  AgentSettingChange,
  AgentSettings,
  AgentSummary,
  AgentTestRequest,
  AgentTestResult,
  SafetyEvent,
  StudioFeature,
  StudioModel,
} from '../model/agent_studio';
import { DecisionOutcome, DecisionPage } from '../model/decision';

const studioBasePath = '/api/agent-studio/';

/** Client for Scout's core Agent Studio routes, which are fixed and unversioned. */
@Injectable({ providedIn: 'root' })
export class AgentStudioService extends BaseRestService {
  /** The optional Studio APIs the backend mounted; `agents` is the core set. */
  features(): Observable<StudioFeature[]> {
    return this.http.get<StudioFeature[]>(this.studioUrl('features'));
  }

  listAgents(): Observable<AgentSummary[]> {
    return this.http.get<AgentSummary[]>(this.studioUrl('agents'));
  }

  getDraft(agentName: string): Observable<AgentDraft> {
    return this.http.get<AgentDraft>(this.studioUrl('agent'), { params: { agent_name: agentName } });
  }

  /** Every editable layer must be sent back: one missing from `draft` ends its binding. */
  saveDraft(draft: AgentDraft): Observable<AgentDraft> {
    return this.http.post<AgentDraft>(this.studioUrl('draft'), draft);
  }

  create(request: AgentCreateRequest): Observable<AgentSummary> {
    return this.http.post<AgentSummary>(this.studioUrl('create'), request);
  }

  rename(request: AgentRenameRequest): Observable<AgentSummary> {
    return this.http.post<AgentSummary>(this.studioUrl('rename'), request);
  }

  archive(request: AgentArchiveRequest): Observable<AgentSummary> {
    return this.http.post<AgentSummary>(this.studioUrl('archive'), request);
  }

  unarchive(request: AgentArchiveRequest): Observable<AgentSummary> {
    return this.http.post<AgentSummary>(this.studioUrl('unarchive'), request);
  }

  settings(agentName: string): Observable<AgentSettings> {
    return this.http.get<AgentSettings>(this.studioUrl('settings'), { params: { agent_name: agentName } });
  }

  saveSetting(change: AgentSettingChange): Observable<AgentSettings> {
    return this.http.post<AgentSettings>(this.studioUrl('setting'), change);
  }

  setEnabled(request: AgentSetEnabledRequest): Observable<AgentEnabledState> {
    return this.http.post<AgentEnabledState>(this.studioUrl('enabled'), request);
  }

  /** Runs the saved draft, not unsaved form content. */
  testDraft(request: AgentTestRequest): Observable<AgentTestResult> {
    return this.http.post<AgentTestResult>(this.studioUrl('test'), request);
  }

  publish(request: AgentPublishRequest): Observable<AgentRelease> {
    return this.http.post<AgentRelease>(this.studioUrl('publish'), request);
  }

  restore(request: AgentRestoreRequest): Observable<AgentRelease> {
    return this.http.post<AgentRelease>(this.studioUrl('restore'), request);
  }

  reset(request: AgentResetRequest): Observable<AgentDraft> {
    return this.http.post<AgentDraft>(this.studioUrl('reset'), request);
  }

  setDefault(request: AgentSetDefaultRequest): Observable<AgentSummary[]> {
    return this.http.post<AgentSummary[]>(this.studioUrl('set-default'), request);
  }

  history(agentName: string): Observable<AgentRelease[]> {
    return this.http.get<AgentRelease[]>(this.studioUrl('history'), { params: { agent_name: agentName } });
  }

  auditLog(agentName: string): Observable<AgentAuditEvent[]> {
    return this.http.get<AgentAuditEvent[]>(this.studioUrl('audit'), { params: { agent_name: agentName } });
  }

  releaseSections(agentName: string, version: number): Observable<AgentReleaseSection[]> {
    return this.http.get<AgentReleaseSection[]>(this.studioUrl('release-sections'), {
      params: { agent_name: agentName, version: String(version) },
    });
  }

  models(): Observable<StudioModel[]> {
    return this.http.get<StudioModel[]>(this.studioUrl('models'));
  }

  /** Scout's optional `decisions` feature: the tenant's decision records, newest first. */
  decisions(before = 0, limit = 0, category = '', outcome?: DecisionOutcome): Observable<DecisionPage> {
    const params: Record<string, string> = {};
    if (before) params['before'] = String(before);
    if (limit) params['limit'] = String(limit);
    if (category) params['category'] = category;
    if (outcome) params['outcome'] = outcome;
    return this.http.get<DecisionPage>(this.studioUrl('decisions'), { params });
  }

  /** Scout's optional `guardrails` feature. */
  guardrails(agentName: string): Observable<AgentGuardrails> {
    return this.http.get<AgentGuardrails>(this.studioUrl('guardrails'), { params: { agent_name: agentName } });
  }

  saveGuardrails(change: AgentGuardrailChange): Observable<AgentGuardrails> {
    return this.http.post<AgentGuardrails>(this.studioUrl('guardrails'), change);
  }

  /** Newest first; pass the last id as `before` for the next page. */
  safetyEvents(agentName: string, before = 0, limit = 50): Observable<SafetyEvent[]> {
    return this.http.get<SafetyEvent[]>(this.studioUrl('safety-events'),
      { params: { agent_name: agentName, before: String(before), limit: String(limit) } });
  }

  private studioUrl(route: string): string {
    return this.url(studioBasePath + route);
  }
}
