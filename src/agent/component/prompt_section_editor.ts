import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AgentMergeMode, AgentPromptLayer, AgentPromptSection } from '../model/agent_studio';

type LayerForm = FormGroup<{
  instruction: FormControl<string>;
  output: FormControl<string>;
  merge_mode: FormControl<AgentMergeMode>;
  sealed: FormControl<boolean>;
}>;

interface LayerRow {
  layer: AgentPromptLayer;
  form: LayerForm | null;
}

export type EditableLayerSlot = 'type' | 'agent';

function layerContentRequired(group: LayerForm): ValidationErrors | null {
  const { instruction, output, merge_mode } = group.getRawValue();
  if (merge_mode === 'replace') return instruction.trim() ? null : { instructionRequired: true };
  return instruction.trim() || output.trim() ? null : { contentRequired: true };
}

/**
 * Editor for one prompt section's layers. Layers keep the server's order; the effective text is
 * shown as received and never merged here. Ships no CSS — style the `.prompt-section*` and
 * `.prompt-layer*` hooks. Selector: <sail-prompt-section-editor>.
 */
@Component({
  selector: 'sail-prompt-section-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  templateUrl: './prompt_section_editor.html',
})
export class PromptSectionEditorComponent {
  readonly section = input.required<AgentPromptSection>();
  readonly agentScopeId = input('');
  readonly typeScopeId = input('');
  readonly disabled = input(false);

  readonly sectionChange = output<AgentPromptSection>();
  readonly validChange = output<boolean>();

  protected readonly forms = new FormArray<LayerForm>([]);
  protected readonly rows = signal<LayerRow[]>([]);
  private emitted?: AgentPromptSection;

  protected readonly sealedAt = computed(() => this.rows().findIndex((row) => row.layer.sealed));
  protected readonly sealedBy = computed(() => this.rows()[this.sealedAt()]?.layer);

  /** The server refuses a save that keeps an agent layer under a sealed type layer. */
  protected readonly sealConflict = computed(() => {
    const rows = this.rows();
    const typeSealed = rows.some((row) => row.form && row.layer.sealed && this.slotOf(row.layer) === 'type');
    return typeSealed && rows.some((row) => row.form && this.slotOf(row.layer) === 'agent');
  });

  protected readonly canAddType = computed(() => this.canAdd(this.typeScopeId()));
  protected readonly canAddAgent = computed(() => this.canAdd(this.agentScopeId()));

  constructor() {
    effect(() => {
      const section = this.section();
      if (section === this.emitted) return;
      untracked(() => this.rebuild(section.layers));
    });
    effect(() => {
      const locked = this.disabled();
      const sealedAt = this.sealedAt();
      untracked(() => this.applyLocks(locked, sealedAt));
    });
    this.forms.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.sync(true));
  }

  protected slotOf(layer: AgentPromptLayer): EditableLayerSlot | undefined {
    if (layer.scope_id && layer.scope_id === this.typeScopeId()) return 'type';
    if (layer.scope_id && layer.scope_id === this.agentScopeId()) return 'agent';
    return undefined;
  }

  protected isUnderSeal(index: number): boolean {
    const sealedAt = this.sealedAt();
    return sealedAt >= 0 && index > sealedAt;
  }

  protected addLayer(slot: EditableLayerSlot): void {
    const layer: AgentPromptLayer = {
      scope_id: slot === 'type' ? this.typeScopeId() : this.agentScopeId(),
      scope_kind: '',
      merge_mode: 'append',
      sealed: false,
      editable: true,
      instruction: '',
      output: '',
    };
    const layers = this.rows().map((row) => row.layer);
    // Type before agent, both after every read-only layer.
    const agentAt = layers.findIndex((existing) => this.slotOf(existing) === 'agent');
    const at = slot === 'type' && agentAt >= 0 ? agentAt : layers.length;
    layers.splice(at, 0, layer);
    this.rebuild(layers);
    this.emit();
  }

  /** Removing an editable layer ends its binding on the next save. */
  protected removeLayer(index: number): void {
    this.rebuild(this.rows().map((row) => row.layer).filter((_, at) => at !== index));
    this.emit();
  }

  private canAdd(scopeId: string): boolean {
    if (!scopeId || this.disabled() || this.sealedAt() >= 0) return false;
    return !this.rows().some((row) => row.layer.scope_id === scopeId);
  }

  private rebuild(layers: AgentPromptLayer[]): void {
    this.forms.clear({ emitEvent: false });
    const rows = layers.map((layer) => ({ layer, form: layer.editable ? this.formFor(layer) : null }));
    for (const row of rows) if (row.form) this.forms.push(row.form, { emitEvent: false });
    this.rows.set(rows);
    this.sync(false);
  }

  private formFor(layer: AgentPromptLayer): LayerForm {
    return new FormGroup(
      {
        instruction: new FormControl(layer.instruction, { nonNullable: true }),
        output: new FormControl(layer.output, { nonNullable: true }),
        merge_mode: new FormControl<AgentMergeMode>(layer.merge_mode, { nonNullable: true }),
        sealed: new FormControl(layer.sealed, { nonNullable: true }),
      },
      { validators: (group) => layerContentRequired(group as LayerForm) },
    );
  }

  private sync(announce: boolean): void {
    this.rows.update((rows) =>
      rows.map((row) => (row.form ? { ...row, layer: { ...row.layer, ...row.form.getRawValue() } } : row)),
    );
    if (announce) this.emit();
  }

  private applyLocks(locked: boolean, sealedAt: number): void {
    this.rows().forEach((row, index) => {
      if (!row.form) return;
      const lock = locked || (sealedAt >= 0 && index > sealedAt);
      if (lock && row.form.enabled) row.form.disable({ emitEvent: false });
      if (!lock && row.form.disabled) row.form.enable({ emitEvent: false });
    });
    this.validChange.emit(this.isValid());
  }

  private isValid(): boolean {
    return !this.sealConflict() && this.rows().every((row) => !row.form || !row.form.invalid);
  }

  private emit(): void {
    this.emitted = { ...this.section(), layers: this.rows().map((row) => row.layer) };
    this.sectionChange.emit(this.emitted);
    this.validChange.emit(this.isValid());
  }
}
