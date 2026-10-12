import { AgentReleaseSection } from '../model/agent_studio';

export interface ReleaseSectionDiff {
  language_code: string;
  prompt_header_id: number;
  caption: string;
  status: 'added' | 'changed' | 'removed';
  old_text: string;
  new_text: string;
}

/**
 * Section changes from `prior` to `current`, keyed by language and prompt header. Caption and
 * description are part of the compiled prompt, so they count; so does a pure reordering.
 */
export function diffReleaseSections(prior: AgentReleaseSection[], current: AgentReleaseSection[]): ReleaseSectionDiff[] {
  const key = (s: AgentReleaseSection) => `${s.language_code}#${s.prompt_header_id}`;
  const text = (s: AgentReleaseSection) =>
    `${s.description ? `${s.caption} — ${s.description}` : s.caption}\n${s.output ? `${s.instruction}\n\nOutput: ${s.output}` : s.instruction}`;
  const row = (s: AgentReleaseSection, status: ReleaseSectionDiff['status'], old_text: string, new_text: string): ReleaseSectionDiff =>
    ({ language_code: s.language_code, prompt_header_id: s.prompt_header_id, caption: s.caption, status, old_text, new_text });
  const remaining = new Map(prior.map((s) => [key(s), s]));
  const rows: ReleaseSectionDiff[] = [];
  for (const section of current) {
    const old = remaining.get(key(section));
    remaining.delete(key(section));
    if (!old) rows.push(row(section, 'added', '', text(section)));
    else if (text(old) !== text(section)) rows.push(row(section, 'changed', text(old), text(section)));
    else if (old.sequence !== section.sequence) rows.push(row(section, 'changed', `position ${old.sequence}`, `position ${section.sequence}`));
  }
  for (const old of remaining.values()) rows.push(row(old, 'removed', text(old), ''));
  return rows;
}
