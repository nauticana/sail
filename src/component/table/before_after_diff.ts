import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

export type DiffTokenKind = 'same' | 'add' | 'del';

export interface DiffToken {
  text: string;
  kind: DiffTokenKind;
}

/** Whitespace-preserving word-level LCS diff with a bounded work limit. */
export function wordDiff(before: string, after: string, maxTokens = 2000): DiffToken[] {
  const left = before.split(/(\s+)/).filter((token) => token.length > 0);
  const right = after.split(/(\s+)/).filter((token) => token.length > 0);
  if (left.length > maxTokens || right.length > maxTokens) return [{ text: after, kind: 'add' }];

  const matrix = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      matrix[i][j] = left[i] === right[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      tokens.push({ text: left[i++], kind: 'same' });
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      tokens.push({ text: left[i++], kind: 'del' });
    } else {
      tokens.push({ text: right[j++], kind: 'add' });
    }
  }
  while (i < left.length) tokens.push({ text: left[i++], kind: 'del' });
  while (j < right.length) tokens.push({ text: right[j++], kind: 'add' });
  return tokens;
}

@Component({
  selector: 'sail-before-after-diff',
  templateUrl: './before_after_diff.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BeforeAfterDiffComponent {
  readonly before = input.required<string>();
  readonly after = input.required<string>();
  readonly maxTokens = input<number>(2000);
  readonly tokens = computed(() => wordDiff(this.before(), this.after(), this.maxTokens()));
}
