import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VerificationStep } from '../../model/dashboard';

/**
 * Self-service verification flow — a sibling to the 2FA verify component, but
 * backend-agnostic: it owns the request → enter-code → confirmed UI and emits
 * `requestVerification` / `confirmCode`, while the host wires the actual endpoints
 * and feeds `step` + `errorMessage` back (daxoom wires business verify/confirm).
 */
@Component({
  selector: 'sail-verification-flow',
  templateUrl: './verification_flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class VerificationFlowComponent {
  readonly step = input<VerificationStep>('idle');
  readonly errorMessage = input<string>('');
  /** The email/phone/identifier being verified, shown in the copy. */
  readonly target = input<string>('');
  readonly requestVerification = output<void>();
  readonly confirmCode = output<string>();

  readonly code = signal('');

  submit(): void {
    const c = this.code().trim();
    if (c) {
      this.confirmCode.emit(c);
    }
  }
}
