import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseRestService } from '../../service/base_rest.service';
import {
  AgentArchiveRequest,
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
  StudioFeature,
  StudioModel,
} from '../model/agent_studio';

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

  private studioUrl(route: string): string {
    return this.url(studioBasePath + route);
  }
}
