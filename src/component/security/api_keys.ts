import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { ApiKey, MintedApiKey } from '../../model/access';
import { AccessService } from '../../service/access.service';
import { LabelOption, LabelService } from '../../service/label.service';
import { BaseAsync } from '../abstract/base_async';

/**
 * The partner's API keys: mint one with scopes, allowed networks and an optional expiry (the
 * plaintext shows once), restrict its networks later, or revoke it. The app offers scopes as options
 * or constant domains; keel's `ScopePolicy` decides and may supply them. Selector: <sail-api-keys>.
 */
@Component({
  selector: 'sail-api-keys',
  templateUrl: './api_keys.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule],
})
export class ApiKeysComponent extends BaseAsync implements OnInit {
  private readonly access = inject(AccessService);
  private readonly labels = inject(LabelService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Scopes offered for a new key, as code and caption. */
  readonly scopes = input<LabelOption[]>([]);
  /** Constant domains whose values are offered as scopes after `scopes`. */
  readonly scopeDomains = input<string[]>([]);
  private readonly domainScopes = signal<LabelOption[]>([]);
  readonly offered = computed(() => [...this.scopes(), ...this.domainScopes()]);

  readonly canGenerate = this.access.canApiKeyAction('generate');
  readonly canRestrict = this.access.canApiKeyAction('restrict');
  readonly canRevoke = this.access.canRevokeApiKey();
  readonly keys = signal<ApiKey[]>([]);
  readonly minted = signal<MintedApiKey | null>(null);
  /** Id of the key whose networks are being edited. */
  readonly restricting = signal<number | null>(null);
  readonly form = this.fb.group({
    keyName:      ['', [Validators.required, Validators.maxLength(100)]],
    allowedCidrs: ['', Validators.maxLength(2000)],
    scopes:       [[] as string[]],
    expiresAt:    [''],
  });
  readonly networks = this.fb.control('', Validators.maxLength(2000));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const domains = [...new Set(this.scopeDomains().map((d) => d.trim()))];
    this.run(forkJoin([this.access.apiKeys(), ...domains.map((d) => this.labels.loadLabels(d))]), ([rows]) => {
      this.keys.set(rows);
      this.domainScopes.set(domains.flatMap((d) => this.labels.options(d)));
    }, 'Failed to load API keys.');
  }

  toggleScope(code: string, checked: boolean): void {
    const control = this.form.controls.scopes;
    control.setValue(checked ? [...control.value, code] : control.value.filter((s) => s !== code));
  }

  mint(): void {
    if (this.form.invalid) return;
    const { keyName, scopes, allowedCidrs, expiresAt } = this.form.getRawValue();
    this.run(this.access.mintApiKey({
      key_name: keyName,
      scopes: scopes.join(','),
      allowed_cidrs: allowedCidrs,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }), (key) => {
      this.minted.set(key);
      this.form.reset();
      this.load();
    }, 'Failed to create the key.');
  }

  editNetworks(key: ApiKey): void {
    this.networks.setValue(key.AllowedCidrs ?? '');
    this.restricting.set(key.Id);
  }

  saveNetworks(key: ApiKey): void {
    if (this.networks.invalid) return;
    this.run(this.access.restrictApiKey(key.Id, this.networks.value), () => {
      this.restricting.set(null);
      this.successMessage.set(`Networks of "${key.KeyName}" saved.`);
      this.load();
    }, 'Failed to save the networks.');
  }

  revoke(key: ApiKey): void {
    if (!confirm(`Revoke key "${key.KeyName}" (${key.KeyPrefix}…)? Anything using it stops working.`)) return;
    this.run(this.access.revokeApiKey(key.Id), () => {
      this.successMessage.set(`Key "${key.KeyName}" revoked.`);
      this.load();
    }, 'Failed to revoke the key.');
  }
}
