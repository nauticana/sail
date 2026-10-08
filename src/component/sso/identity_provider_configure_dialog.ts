import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TableActionParameter } from '../../model/appdata';
import { ConstantValue } from '../../model/common';
import { RestURL } from '../../service/rest_url';
import { ActionParamsDialog } from '../table/action_params_dialog';

/** identity_protocol code for SAML 2.0; anything else configures OpenID Connect. */
const SAML = 'S';
/** oidc_client_auth code for private key JWT; the other codes take a client secret. */
const PRIVATE_KEY_JWT = 'J';
const SAML_ONLY = new Set(['idp_metadata']);
const OIDC_ONLY = new Set(['issuer', 'client_id', 'client_auth', 'client_secret', 'private_key', 'operator_client', 'scopes']);
const DOMAINS: Record<string, string> = { protocol: 'identity_protocol', client_auth: 'oidc_client_auth' };
const CLIENT_FIELDS = new Set(['client_id', 'client_auth', 'client_secret', 'private_key']);

/**
 * keel's partner_identity_provider `configure` action: shows only the fields of the
 * chosen protocol, and links keel's SAML service provider metadata.
 */
@Component({
  selector: 'sail-identity-provider-configure-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: '../table/action_params_dialog.html',
})
export class IdentityProviderConfigureDialog extends ActionParamsDialog {
  protected override arrange(params: TableActionParameter[]): TableActionParameter[] {
    return params
      .map((param) => param.name === 'client_secret' ? { ...param, dataType: 'secret' } : param)
      .sort((a, b) => Number(b.name === 'protocol') - Number(a.name === 'protocol'));
  }

  protected override optionsFor(param: TableActionParameter): ConstantValue[] | undefined {
    const domain = DOMAINS[param.name];
    return domain ? this.auth.getDomainValues(domain) : super.optionsFor(param);
  }

  protected override shown(name: string): boolean {
    if (this.form.controls['protocol']?.value === SAML) return !OIDC_ONLY.has(name);
    if (SAML_ONLY.has(name)) return false;
    if (CLIENT_FIELDS.has(name) && String(this.form.controls['operator_client']?.value ?? '').trim()) return false;
    const clientAuth = this.form.controls['client_auth']?.value;
    if (name === 'client_secret') return clientAuth !== PRIVATE_KEY_JWT;
    if (name === 'private_key') return clientAuth === PRIVATE_KEY_JWT;
    return true;
  }

  protected override hint(name: string): { href: string; label: string } | null {
    return name === 'idp_metadata'
      ? { href: RestURL.httpHost + RestURL.ssoSamlMetadataURL, label: 'Service provider metadata for your identity provider' }
      : null;
  }
}
