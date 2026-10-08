import {
  ChangeDetectionStrategy, Component, ViewEncapsulation,
  computed, effect, inject, input, linkedSignal, output, signal, untracked,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { VerificationStep } from '../../model/dashboard';
import { BaseAuthService } from '../../service/auth.service';
import { DOMAIN_VERIFIER, DomainChallenge, DomainVerificationMethod } from '../../service/domain_verifier';
import { BaseAsync } from '../abstract/base_async';
import { VerificationFlowComponent } from '../dashboard/verification_flow';

/**
 * Domain-ownership verification: the domain field plus the steps of the chosen method
 * (email code, DNS TXT record or HTTP file), driven against the injected
 * `DOMAIN_VERIFIER`. The app owns the endpoints, the page shell and the styling;
 * `verified` fires once with the domain that was proven.
 *
 * Selector: <sail-domain-verification>
 */
@Component({
  selector: 'sail-domain-verification',
  templateUrl: './domain_verification.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, VerificationFlowComponent],
})
export class DomainVerificationComponent extends BaseAsync {
  private readonly verifier = inject(DOMAIN_VERIFIER);
  private readonly auth = inject(BaseAuthService, { optional: true });
  private readonly clipboard = inject(Clipboard);

  readonly domainInput = input('', { alias: 'domain' });
  readonly label = input('Domain');
  readonly resendAfterSeconds = input(60);
  readonly codeExpiresInSeconds = input(0);
  /** Methods offered, first is the default; DT and HF need `DomainVerifier.challenge`. */
  readonly methodsInput = input<DomainVerificationMethod[]>(['EC'], { alias: 'methods' });

  readonly domainChange = output<string>();
  readonly verified = output<string>();

  readonly domain = signal('');
  readonly step = signal<VerificationStep>('idle');
  readonly isVerified = computed(() => this.step() === 'verified');
  readonly methods = computed(() => this.methodsInput().filter((m) => m === 'EC' || !!this.verifier.challenge));
  readonly method = linkedSignal<DomainVerificationMethod>(() => this.methods()[0] ?? 'EC');
  readonly challenge = signal<DomainChallenge | null>(null);
  /** Captions from keel's domain_verification_method catalog; the code when it is not loaded. */
  protected readonly methodOptions = computed(() => {
    const captions = this.auth?.getDomainValues('domain_verification_method') ?? [];
    return this.methods().map((value) => ({ value, caption: captions.find((c) => c.Value === value)?.Caption ?? value }));
  });

  constructor() {
    super();
    effect(() => {
      const value = this.domainInput();
      if (value === untracked(this.domain)) return;
      this.domain.set(value);
      this.reset();
    });
  }

  protected onDomainInput(value: string): void {
    this.domain.set(value);
    this.reset();   // a code or challenge is bound to the domain it was issued for
    this.domainChange.emit(value);
  }

  protected selectMethod(method: DomainVerificationMethod): void {
    this.method.set(method);
    this.reset();
  }

  protected issueChallenge(): void {
    const domain = this.domain().trim();
    const method = this.method();
    if (!domain || method === 'EC' || !this.verifier.challenge || this.isVerified() || this.loading()) return;
    this.run(
      this.verifier.challenge(domain, method),
      (challenge) => {
        this.challenge.set(challenge);
        this.step.set('requested');
      },
      'Could not start the verification.',
    );
  }

  protected copy(value: string): void {
    this.clipboard.copy(value);
  }

  private reset(): void {
    this.step.set('idle');
    this.challenge.set(null);
    this.clearMessages();
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

  /** Confirms the email code, or the published challenge when `code` is empty. */
  protected confirm(code: string): void {
    const domain = this.domain().trim();
    if (!domain || this.isVerified() || this.loading()) return;
    this.step.set('verifying');
    this.run(
      this.verifier.confirm(domain, code, this.method()),
      () => {
        this.step.set('verified');
        this.verified.emit(domain);
      },
      'Verification failed.',
      () => this.step.set('error'),
    );
  }
}
