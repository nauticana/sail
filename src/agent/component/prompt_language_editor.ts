import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AgentLanguageDraft, AgentPromptSection, AgentResetScope } from '../model/agent_studio';
import { PromptSectionEditorComponent } from './prompt_section_editor';

/** What to reset; the page adds the agent name and both expected revisions. */
export interface PromptResetTarget {
  scope: AgentResetScope;
  /** 0 = every section. */
  prompt_header_id: number;
  /** '' = every language. */
  language_code: string;
}

/**
 * The prompt sections of one language. Emits the whole language on every edit so a save always
 * carries every layer back. Selector: <sail-prompt-language-editor>.
 */
@Component({
  selector: 'sail-prompt-language-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatSelectModule, PromptSectionEditorComponent],
  templateUrl: './prompt_language_editor.html',
})
export class PromptLanguageEditorComponent {
  readonly language = input.required<AgentLanguageDraft>();
  readonly agentScopeId = input('');
  readonly typeScopeId = input('');
  readonly disabled = input(false);

  readonly languageChange = output<AgentLanguageDraft>();
  readonly validChange = output<boolean>();
  readonly resetRequested = output<PromptResetTarget>();

  protected readonly resetScope = new FormControl<AgentResetScope>('agent_override', { nonNullable: true });
  protected readonly everyLanguage = new FormControl(false, { nonNullable: true });
  private readonly invalidSections = signal<ReadonlySet<number>>(new Set());

  constructor() {
    effect(() => {
      for (const control of [this.resetScope, this.everyLanguage]) {
        if (this.disabled()) control.disable({ emitEvent: false });
        else control.enable({ emitEvent: false });
      }
    });
  }

  protected replaceSection(section: AgentPromptSection): void {
    const current = this.language();
    this.languageChange.emit({
      ...current,
      prompt_sections: current.prompt_sections.map((existing) =>
        existing.prompt_header_id === section.prompt_header_id ? section : existing,
      ),
    });
  }

  protected setSectionValid(promptHeaderId: number, valid: boolean): void {
    const invalid = new Set(this.invalidSections());
    if (valid) invalid.delete(promptHeaderId);
    else invalid.add(promptHeaderId);
    this.invalidSections.set(invalid);
    this.validChange.emit(invalid.size === 0);
  }

  protected requestReset(promptHeaderId: number): void {
    this.resetRequested.emit({
      scope: this.resetScope.value,
      prompt_header_id: promptHeaderId,
      language_code: this.everyLanguage.value ? '' : this.language().language_code,
    });
  }
}
