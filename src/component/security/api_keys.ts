import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiKey, MintedApiKey } from '../../model/access';
import { AccessService } from '../../service/access.service';
import { LabelOption } from '../../service/label.service';
import { BaseAsync } from '../abstract/base_async';

/**
 * The partner's API keys: mint one with scopes and allowed networks (the plaintext shows once),
 * restrict its networks later, or revoke it. The app passes the scopes it offers; keel's
 * `ScopePolicy` still decides. Selector: <sail-api-keys>.
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
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Scopes offered for a new key, as code and caption. */
  readonly scopes = input.required<LabelOption[]>();

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
    scopes:       [[] as string[], Validators.required],
  });
  readonly networks = this.fb.control('', Validators.maxLength(2000));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(this.access.apiKeys(), (rows) => this.keys.set(rows), 'Failed to load API keys.');
  }

  toggleScope(code: string, checked: boolean): void {
    const control = this.form.controls.scopes;
    control.setValue(checked ? [...control.value, code] : control.value.filter((s) => s !== code));
  }

  mint(): void {
    if (this.form.invalid) return;
    const { keyName, scopes, allowedCidrs } = this.form.getRawValue();
    this.run(this.access.mintApiKey(keyName, scopes, allowedCidrs), (key) => {
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
