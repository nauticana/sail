import {
  ChangeDetectionStrategy, Component, ViewEncapsulation,
  computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { VerificationStep } from '../../model/dashboard';
import { DOMAIN_VERIFIER } from '../../service/domain_verifier';
import { BaseAsync } from '../abstract/base_async';
import { VerificationFlowComponent } from '../dashboard/verification_flow';

/**
 * Domain-ownership verification: the domain field plus the send-code → confirm steps,
 * driven against the injected `DOMAIN_VERIFIER`. The app owns the endpoints, the page
 * shell and the styling; `verified` fires once with the domain that was proven.
 *
 * Selector: <sail-domain-verification>
 */
@Component({
  selector: 'sail-domain-verification',
  templateUrl: './domain_verification.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatFormFieldModule, MatIconModule, MatInputModule, VerificationFlowComponent],
})
export class DomainVerificationComponent extends BaseAsync {
  private readonly verifier = inject(DOMAIN_VERIFIER);

  readonly domainInput = input('', { alias: 'domain' });
  readonly label = input('Domain');
  readonly resendAfterSeconds = input(60);
  readonly codeExpiresInSeconds = input(0);

  readonly domainChange = output<string>();
  readonly verified = output<string>();

  readonly domain = signal('');
  readonly step = signal<VerificationStep>('idle');
  readonly isVerified = computed(() => this.step() === 'verified');

  constructor() {
    super();
    effect(() => {
      const value = this.domainInput();
      if (value === untracked(this.domain)) return;
      this.domain.set(value);
      this.step.set('idle');
      this.clearMessages();
    });
  }

  protected onDomainInput(value: string): void {
    this.domain.set(value);
    this.step.set('idle');   // a code is bound to the domain it was issued for
    this.clearMessages();
    this.domainChange.emit(value);
  }

  protected request(): void {
    const domain = this.domain().trim();
    if (!domain || this.isVerified() || this.loading()) return;
    this.run(
      this.verifier.requestVerification(domain),
      () => this.step.set('requested'),
      'Could not send the verification code.',
      () => this.step.set('idle'),
    );
  }

  protected confirm(code: string): void {
    const domain = this.domain().trim();
    if (!domain || this.isVerified() || this.loading()) return;
    this.step.set('verifying');
    this.run(
      this.verifier.confirm(domain, code),
      () => {
        this.step.set('verified');
        this.verified.emit(domain);
      },
      'Verification failed.',
      () => this.step.set('error'),
    );
  }
}
