import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AgentReleaseSection } from '../model/agent_studio';

interface ReleaseLanguageGroup {
  language_code: string;
  sections: AgentReleaseSection[];
}

/**
 * Frozen prompt sections of one release, each beside the layer that decided it. Read-only:
 * provenance never changes after publication. Selector: <sail-release-sections>.
 */
@Component({
  selector: 'sail-release-sections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: './release_sections.html',
})
export class ReleaseSectionsComponent {
  readonly sections = input.required<AgentReleaseSection[]>();

  protected readonly languages = computed<ReleaseLanguageGroup[]>(() => {
    const groups = new Map<string, AgentReleaseSection[]>();
    for (const section of this.sections()) {
      const group = groups.get(section.language_code);
      if (group) group.push(section);
      else groups.set(section.language_code, [section]);
    }
    return [...groups].map(([language_code, sections]) => ({ language_code, sections }));
  });
}
