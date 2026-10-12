import { DatePipe, JsonPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, contentChildren, inject, input, signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Observable, forkJoin, map } from 'rxjs';
import { BaseAuthService } from '../../service/auth.service';
import { CaptionPipe } from '../../service/caption_pipe';
import { LabelOption, LabelService } from '../../service/label.service';
import {
  AGENT_READINESS_CAPTIONS, AgentAuditEvent, AgentDraft, AgentGuardrails, AgentLanguageDraft, AgentMergeMode,
  AgentModelSelection, AgentRelease, AgentSetting, AgentSettings, AgentSummary, AgentTestResult, GuardrailRule,
  SafetyEvent, StudioFeature, StudioModel,
} from '../model/agent_studio';
import { AgentStudioService } from '../service/agent_studio.service';
import { ReleaseSectionDiff, diffReleaseSections } from '../util/release_diff';
import { studioErrorMessage } from '../util/studio_errors';
import { PromptLanguageEditorComponent, PromptResetTarget } from './prompt_language_editor';
import { StudioTabDirective } from './studio_tab';

const CORE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'settings', label: 'Settings' },
  { id: 'test', label: 'Test' },
  { id: 'history', label: 'History' },
];
const GUARDRAILS_TAB = { id: 'guardrails', label: 'Guardrails' };

/**
 * Embeddable Agent Studio over Scout's core `agents` feature: a grouped agent rail and tabs
 * for the draft, prompts, scoped settings, tests, and release history, a Guardrails tab when the
 * manifest lists that feature, plus product tabs declared with `sailStudioTab`. A control shows only when the feature manifest lists its
 * action and the caller holds the grant; hiding is never the authorization, Scout decides.
 * Selector: <sail-studio-page>.
 */
@Component({
  selector: 'sail-studio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, JsonPipe, NgTemplateOutlet, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, CaptionPipe, PromptLanguageEditorComponent,
  ],
  templateUrl: './studio_page.html',
})
export class StudioPageComponent implements OnInit {
  private readonly studio = inject(AgentStudioService);
  private readonly auth = inject(BaseAuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly labels = inject(LabelService);

  /** Rail group of an agent; its type by default. */
  readonly groupBy = input<(agent: AgentSummary) => string>((agent) => agent.agent_type);
  private readonly productTabs = contentChildren(StudioTabDirective);

  readonly features = signal<StudioFeature[]>([]);
  readonly models = signal<StudioModel[]>([]);
  readonly summaries = signal<AgentSummary[]>([]);
  readonly showArchived = signal(false);
  readonly selectedName = signal('');
  readonly draft = signal<AgentDraft | null>(null);
  private readonly baseline = signal('');
  readonly settings = signal<AgentSettings | null>(null);
  readonly releases = signal<AgentRelease[]>([]);
  readonly audit = signal<AgentAuditEvent[]>([]);
  readonly guardrails = signal<AgentGuardrails | null>(null);
  readonly safetyEvents = signal<SafetyEvent[]>([]);
  readonly safetyExhausted = signal(true);
  readonly diff = signal<{ version: number; previous: number; rows: ReleaseSectionDiff[] } | null>(null);
  readonly testResult = signal<AgentTestResult | null>(null);
  readonly tab = signal('overview');
  readonly language = signal('');
  readonly promptsValid = signal(true);
  readonly changeSummary = signal('');
  readonly mergeModes = toSignal(this.labels.loadLabels('config_merge_mode').pipe(
    map(() => this.labels.options('config_merge_mode'))), { initialValue: [] as LabelOption[] });
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  private readonly pending = signal(0);
  readonly busy = computed(() => this.pending() > 0);

  readonly tabs = computed(() => [
    ...CORE_TABS, ...(this.feature('guardrails') ? [GUARDRAILS_TAB] : []),
    ...this.productTabs().map((t) => ({ id: t.id(), label: t.label() })),
  ]);
  readonly productTab = computed(() => this.productTabs().find((t) => t.id() === this.tab()));
  readonly selected = computed(() => this.summaries().find((a) => a.agent_name === this.selectedName()));
  readonly dirty = computed(() => this.draft() !== null && JSON.stringify(this.draft()) !== this.baseline());
  readonly currentLanguage = computed<AgentLanguageDraft | undefined>(() => {
    const languages = this.draft()?.languages ?? [];
    return languages.find((l) => l.language_code === this.language()) ?? languages[0];
  });
  readonly groups = computed(() => {
    const groupOf = this.groupBy();
    const groups = new Map<string, AgentSummary[]>();
    for (const agent of this.summaries()) {
      if (agent.archived && !this.showArchived()) continue;
      const key = groupOf(agent);
      groups.set(key, [...(groups.get(key) ?? []), agent]);
    }
    return [...groups].map(([name, agents]) => ({ name, agents }));
  });

  ngOnInit(): void {
    this.call(this.studio.features(), (features) => this.features.set(features));
    this.call(this.studio.models(), (models) => this.models.set(models));
    this.loadList();
  }

  /** For a canDeactivate guard. */
  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  /** Whether `feature` serves `action` and the caller holds it at `value` (the selected agent by default). */
  can(action: string, value = `agent:${this.selectedName()}`, feature = 'agents'): boolean {
    const f = this.feature(feature);
    return !!f?.actions.includes(action) && this.auth.hasPermission(f.object || 'AGENT_STUDIO', action, value);
  }

  private feature(id: string): StudioFeature | undefined {
    return this.features().find((f) => f.id === id);
  }

  readinessCaption(code: string): string {
    return AGENT_READINESS_CAPTIONS[code] ?? code;
  }

  modelsOf(type: string): StudioModel[] {
    return this.models().filter((m) => m.model_type === type);
  }

  loadList(select?: string): void {
    this.call(this.studio.listAgents(), (rows) => {
      this.summaries.set(rows);
      const target = select ?? (this.selectedName() || rows.find((a) => !a.archived)?.agent_name);
      if (target && target !== this.selectedName()) this.select(target, true);
    });
  }

  select(agentName: string, force = false): void {
    if (!force && agentName === this.selectedName()) return;
    if (!force && this.dirty() && !window.confirm('Discard unsaved changes for this agent?')) return;
    this.selectedName.set(agentName);
    this.draft.set(null);
    this.settings.set(null);
    this.releases.set([]);
    this.audit.set([]);
    this.guardrails.set(null);
    this.safetyEvents.set([]);
    this.diff.set(null);
    this.testResult.set(null);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.loadAgent();
  }

  openTab(id: string): void {
    this.tab.set(id);
    if (id === 'history') this.loadHistory();
    if (id === 'guardrails') this.loadGuardrails();
  }

  private loadAgent(): void {
    const name = this.selectedName();
    this.call(this.studio.getDraft(name), (draft) => this.applyDraft(draft), name);
    this.call(this.studio.settings(name), (settings) => this.settings.set(settings), name);
    if (this.tab() === 'history') this.loadHistory();
    if (this.tab() === 'guardrails') this.loadGuardrails();
  }

  private applyDraft(draft: AgentDraft): void {
    this.draft.set(draft);
    this.baseline.set(JSON.stringify(draft));
    this.promptsValid.set(true);
  }

  /** Carries new revisions into the draft and its baseline without touching unsaved edits. */
  private applyRevisions(agentRevision: number, typeRevision?: number, patch: Partial<AgentDraft> = {}): void {
    const revisions: Partial<AgentDraft> = { ...patch, expected_agent_revision: agentRevision };
    if (typeRevision !== undefined) revisions.expected_type_defaults_revision = typeRevision;
    const d = this.draft();
    if (!d) return;
    this.draft.set({ ...d, ...revisions });
    this.baseline.set(JSON.stringify({ ...(JSON.parse(this.baseline()) as AgentDraft), ...revisions }));
  }

  patchDraft(changes: Partial<AgentDraft>): void {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...changes });
  }

  patchModel(field: keyof AgentModelSelection, value: string): void {
    const d = this.draft();
    if (d) this.patchDraft({ models: { ...d.models, [field]: value } });
  }

  updateLanguage(language: AgentLanguageDraft): void {
    const d = this.draft();
    if (d) this.patchDraft({ languages: d.languages.map((l) => l.language_code === language.language_code ? language : l) });
  }

  discard(): void {
    if (window.confirm('Discard unsaved changes?')) this.draft.set(JSON.parse(this.baseline()) as AgentDraft);
  }

  save(): void {
    const d = this.draft();
    if (!d) return;
    this.act(this.studio.saveDraft(d), (saved) => {
      this.applyDraft(saved);
      this.successMessage.set('Draft saved.');
      this.loadList();
    }, d.agent_name);
  }

  setEnabled(enabled: boolean): void {
    const d = this.draft();
    if (!d) return;
    this.act(this.studio.setEnabled({ agent_name: d.agent_name, enabled, expected_agent_revision: d.expected_agent_revision }), (state) => {
      this.applyRevisions(state.expected_agent_revision, undefined, { enabled: state.enabled });
      this.loadList();
    }, d.agent_name);
  }

  makeDefault(): void {
    const d = this.draft();
    if (!d || !window.confirm(`Make "${d.display_name}" the default ${d.agent_type} agent?`)) return;
    this.act(this.studio.setDefault({ agent_name: d.agent_name, expected_type_defaults_revision: d.expected_type_defaults_revision }), (rows) => {
      this.summaries.set(rows);
      this.loadAgent();
    }, d.agent_name);
  }

  setArchived(archived: boolean): void {
    const d = this.draft();
    if (!d || (archived && !window.confirm(`Archive "${d.display_name}"?`))) return;
    const request = { agent_name: d.agent_name, expected_agent_revision: d.expected_agent_revision };
    this.act(archived ? this.studio.archive(request) : this.studio.unarchive(request), (summary) => {
      this.applyRevisions(summary.agent_revision);
      this.loadList();
    }, d.agent_name);
  }

  /** Creates an agent of the selected agent's type, copied from its saved draft. */
  createCopy(displayName: string): void {
    const d = this.draft();
    if (!d || !displayName.trim()) return;
    this.act(this.studio.create({
      agent_type: d.agent_type, display_name: displayName.trim(), copy_from: d.agent_name, idempotency_key: crypto.randomUUID(),
    }), (created) => this.loadList(created.agent_name));
  }

  reset(target: PromptResetTarget): void {
    const d = this.draft();
    if (!d || !window.confirm('Reset these prompt sections? Publish to make it live.')) return;
    this.act(this.studio.reset({
      agent_name: d.agent_name, ...target,
      expected_agent_revision: d.expected_agent_revision, expected_type_defaults_revision: d.expected_type_defaults_revision,
    }), (draft) => this.applyDraft(draft), d.agent_name);
  }

  saveSetting(binding: Pick<AgentSetting, 'scope_id' | 'resource_kind' | 'resource_id' | 'merge_mode' | 'sealed'>, valueText: string, remove = false): void {
    const s = this.settings();
    if (!s) return;
    let value: unknown;
    if (!remove) {
      try {
        value = JSON.parse(valueText);
      } catch {
        this.errorMessage.set('The value must be valid JSON.');
        return;
      }
    }
    this.act(this.studio.saveSetting({
      agent_name: s.agent_name, scope_id: binding.scope_id, resource_kind: binding.resource_kind.trim(),
      resource_id: binding.resource_id.trim(), merge_mode: binding.merge_mode, sealed: binding.sealed, value, remove,
      expected_agent_revision: s.expected_agent_revision, expected_type_defaults_revision: s.expected_type_defaults_revision,
    }), (saved) => {
      this.settings.set(saved);
      this.applyRevisions(saved.expected_agent_revision, saved.expected_type_defaults_revision);
    }, s.agent_name);
  }

  addSetting(scopeId: string, kind: string, id: string, mergeMode: AgentMergeMode, valueText: string): void {
    this.saveSetting({ scope_id: scopeId, resource_kind: kind, resource_id: id, merge_mode: mergeMode, sealed: false }, valueText);
  }

  runTest(task: string, inputData: string): void {
    const name = this.selectedName();
    this.testResult.set(null);
    this.act(this.studio.testDraft({
      agent_name: name, language_code: this.currentLanguage()?.language_code ?? '', task: task.trim(), input_data: inputData.trim(),
    }), (result) => this.testResult.set(result), name);
  }

  publish(): void {
    const d = this.draft();
    if (!d) return;
    this.act(this.studio.publish({
      agent_name: d.agent_name, change_summary: this.changeSummary().trim(),
      expected_agent_revision: d.expected_agent_revision, expected_type_defaults_revision: d.expected_type_defaults_revision,
    }), (release) => {
      this.successMessage.set(`Version ${release.version} published${release.active ? ' and active' : ''}.`);
      this.changeSummary.set('');
      this.loadList();
      this.loadAgent();
    }, d.agent_name);
  }

  restore(version: number): void {
    if (!window.confirm(`Restore version ${version}? It is published again as a new version.`)) return;
    this.act(this.studio.restore({ agent_name: this.selectedName(), version }), (release) => {
      this.successMessage.set(`Version ${release.version} published from version ${version}.`);
      this.loadList();
      this.loadAgent();
    }, this.selectedName());
  }

  loadHistory(): void {
    const name = this.selectedName();
    this.diff.set(null);
    this.call(forkJoin([this.studio.history(name), this.studio.auditLog(name)]), ([releases, audit]) => {
      this.releases.set(releases);
      this.audit.set(audit);
    }, name);
  }

  loadGuardrails(): void {
    const name = this.selectedName();
    this.safetyEvents.set([]);
    this.call(this.studio.guardrails(name), (g) => this.guardrails.set(g), name);
    this.loadSafetyEvents();
  }

  loadSafetyEvents(): void {
    const name = this.selectedName();
    const before = this.safetyEvents().at(-1)?.id ?? 0;
    this.call(this.studio.safetyEvents(name, before), (events) => {
      this.safetyEvents.update((rows) => [...rows, ...events]);
      this.safetyExhausted.set(events.length < 50);
    }, name);
  }

  /** Replaces the agent's own rules with the JSON array typed in. */
  saveGuardrails(rulesText: string): void {
    const g = this.guardrails();
    if (!g) return;
    let rules: GuardrailRule[];
    try {
      rules = JSON.parse(rulesText.trim() || '[]') as GuardrailRule[];
    } catch {
      this.errorMessage.set('The rules must be a JSON array.');
      return;
    }
    if (!Array.isArray(rules)) {
      this.errorMessage.set('The rules must be a JSON array.');
      return;
    }
    this.act(this.studio.saveGuardrails({ agent_name: g.agent_name, rules, expected_agent_revision: g.expected_agent_revision }), (saved) => {
      this.guardrails.set(saved);
      this.applyRevisions(saved.expected_agent_revision);
      this.successMessage.set('Guardrails saved.');
    }, g.agent_name);
  }

  previousVersion(version: number): number {
    return this.releases().reduce((best, r) => r.version < version && r.version > best ? r.version : best, 0);
  }

  compare(version: number): void {
    const name = this.selectedName();
    const previous = this.previousVersion(version);
    this.act(forkJoin([this.studio.releaseSections(name, previous), this.studio.releaseSections(name, version)]),
      ([prior, current]) => this.diff.set({ version, previous, rows: diffReleaseSections(prior, current) }), name);
  }

  /** Runs a Studio call; a reply for an agent no longer selected is dropped. */
  private call<T>(request: Observable<T>, done: (value: T) => void, agentName?: string): void {
    const current = () => agentName === undefined || agentName === this.selectedName();
    this.pending.update((n) => n + 1);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => { if (current()) done(value); },
      error: (err: unknown) => {
        this.pending.update((n) => n - 1);
        if (current()) this.errorMessage.set(studioErrorMessage(err));
      },
      complete: () => this.pending.update((n) => n - 1),
    });
  }

  /** A user action: clears the previous outcome first. */
  private act<T>(request: Observable<T>, done: (value: T) => void, agentName?: string): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.call(request, done, agentName);
  }
}
