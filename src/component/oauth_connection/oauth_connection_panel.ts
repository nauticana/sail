import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OAuthConnectionService } from '../../service/oauth_connection.service';
import { OAuthConnectionStatus, OAuthConnectionView, PartnerCredential, OAuthProviderDescriptor, OAuthProviderFieldRole } from '../../model/oauth_connection';

/**
 * ConnectionPanel — drop-in UI for keel oauth/connect. Renders a card per
 * app-supplied OAuthProviderDescriptor with connect / disconnect / test. Providers
 * that need inputs (API-key credentials, Shopify's shop) open an inline form;
 * field-less OAuth providers redirect on one click. Ships no CSS — style the
 * documented `.connection-*` hooks. `entityId` scopes per-business connections
 * (0 = tenant-wide). Selector: <sail-oauth-connection-panel>.
 */
@Component({
  selector: 'sail-oauth-connection-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule, NgOptimizedImage],
  templateUrl: './oauth_connection_panel.html',
})
export class OAuthConnectionPanelComponent implements OnInit {
  readonly providers = input<OAuthProviderDescriptor[]>([]);
  readonly entityId = input(0);

  readonly connected = output<string>();
  readonly disconnected = output<string>();

  private readonly svc = inject(OAuthConnectionService);

  readonly connections = signal<PartnerCredential[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly expanded = signal(''); // provider code whose input form is open
  readonly busy = signal(''); // provider code with an action in flight
  private readonly fieldValues = signal<Record<string, Record<string, string>>>({});
  private readonly pendingSuccess = signal<Set<string>>(new Set());
  private reloadSub?: Subscription;
  private successRetries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // The list is already scoped to entityId(), so a per-provider match is correct.
  readonly views = computed<OAuthConnectionView[]>(() => {
    const byProvider = new Map(this.connections().map((c) => [c.Provider, c]));
    return this.providers().map((provider) => ({
      provider,
      connection: byProvider.get(provider.code),
      status: this.toStatus(byProvider.get(provider.code)),
    }));
  });

  constructor() {
    // Reload on init and whenever the entity scope changes.
    effect(() => this.reload(this.entityId()));
    inject(DestroyRef).onDestroy(() => {
      this.reloadSub?.unsubscribe();
      if (this.retryTimer) clearTimeout(this.retryTimer);
    });
  }

  // After an OAuth round-trip keel redirects back with ?<provider>=success. Record
  // the codes (configured providers only), strip them — preserving the hash — and
  // emit `connected` once the reload confirms the row exists (confirmSuccess).
  ngOnInit(): void {
    const q = new URLSearchParams(window.location.search);
    const known = new Set(this.providers().map((p) => p.code));
    const succeeded = new Set<string>();
    q.forEach((value, key) => {
      if (value === 'success' && known.has(key)) succeeded.add(key);
    });
    if (!succeeded.size) return;
    this.pendingSuccess.set(succeeded);
    for (const code of succeeded) q.delete(code);
    const qs = q.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
  }

  private reload(entityId: number): void {
    this.reloadSub?.unsubscribe(); // cancel any in-flight load so a slow old entity can't overwrite the new one
    this.loading.set(true);
    this.expanded.set('');
    this.fieldValues.set({}); // never carry a typed credential across a reload / entity change
    this.reloadSub = this.svc.list(entityId).subscribe({
      next: (rows) => {
        this.connections.set(rows ?? []);
        this.loading.set(false);
        this.confirmSuccess();
      },
      error: (e) => {
        this.error.set(this.msg(e, 'Could not load your connections.'));
        this.loading.set(false);
      },
    });
  }

  // Emit `connected` only for a returned provider whose row is actually present.
  // Rows can lag the redirect (webhook/commit); retry twice before giving up loudly.
  private confirmSuccess(): void {
    const pending = this.pendingSuccess();
    if (!pending.size) return;
    const present = new Set(this.connections().map((c) => c.Provider));
    const missing = [...pending].filter((code) => !present.has(code));
    for (const code of pending) if (present.has(code)) this.connected.emit(code);
    if (!missing.length) {
      this.pendingSuccess.set(new Set());
      this.successRetries = 0;
      return;
    }
    this.pendingSuccess.set(new Set(missing));
    if (this.successRetries < 2) {
      this.successRetries++;
      this.retryTimer = setTimeout(() => this.reload(this.entityId()), 1500 * this.successRetries);
    } else {
      this.pendingSuccess.set(new Set());
      this.successRetries = 0;
      this.error.set('The connection completed but is not visible yet — refresh to check.');
    }
  }

  isIconUrl(icon?: string): boolean {
    return !!icon && (icon.includes('/') || icon.includes('.'));
  }

  private toStatus(c?: PartnerCredential): OAuthConnectionStatus {
    if (!c) return 'disconnected';
    if (c.Status === 'A') return 'connected';
    if (c.Status === 'E') return 'error';
    if (c.Status === 'P') return 'pending';
    return 'disconnected';
  }

  // Providers with inputs or a consent note open a form first; a bare field-less
  // OAuth provider connects on one click.
  connect(v: OAuthConnectionView): void {
    const needsForm = (v.provider.fields ?? []).length > 0 || !!v.provider.connectNote;
    if (needsForm && this.expanded() !== v.provider.code) {
      this.clearFields(v.provider.code); // open blank — never a stale credential
      this.expanded.set(v.provider.code);
      this.error.set('');
      return;
    }
    this.submit(v);
  }

  private clearFields(code: string): void {
    const all = { ...this.fieldValues() };
    delete all[code];
    this.fieldValues.set(all);
  }

  // Submit collected inputs: OAuth → authorize redirect (fields ride as params);
  // API-key → save the role-tagged credential + endpoint.
  submit(v: OAuthConnectionView): void {
    const fields = v.provider.fields ?? [];
    const vals = this.fieldValues()[v.provider.code] ?? {};
    const missing = fields.filter((f) => f.required !== false && !vals[f.key]);
    if (missing.length) {
      this.error.set('Missing ' + missing.map((f) => f.label).join(', '));
      return;
    }
    this.busy.set(v.provider.code);
    this.error.set('');

    if (v.provider.authType === 'oauth') {
      // Only 'param' fields belong in the authorize URL — never a credential/endpoint.
      const extra: Record<string, string> = { entity_id: String(this.entityId()) };
      for (const f of fields) if (f.role === 'param') extra[f.key] = vals[f.key] ?? '';
      this.svc.startOAuth(v.provider.code, extra).subscribe({
        next: (url) => this.redirect(url),
        error: (e) => {
          this.busy.set('');
          this.error.set(this.msg(e, 'Could not start the connection.'));
        },
      });
      return;
    }

    const credRef = this.roleValue(v, vals, 'credential');
    const apiEndpoint = this.roleValue(v, vals, 'endpoint');
    this.svc.saveApiKey(v.provider.code, credRef, apiEndpoint, this.entityId()).subscribe({
      next: () => {
        this.busy.set('');
        this.connected.emit(v.provider.code);
        this.reload(this.entityId());
      },
      error: (e) => {
        this.busy.set('');
        this.error.set(this.msg(e, 'Could not save the key.'));
      },
    });
  }

  private roleValue(v: OAuthConnectionView, vals: Record<string, string>, role: OAuthProviderFieldRole): string {
    const f = (v.provider.fields ?? []).find((x) => x.role === role);
    return f ? (vals[f.key] ?? '') : '';
  }

  setField(code: string, key: string, ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    const all = { ...this.fieldValues() };
    all[code] = { ...(all[code] ?? {}), [key]: value };
    this.fieldValues.set(all);
  }

  test(v: OAuthConnectionView): void {
    if (!v.connection) return;
    this.busy.set(v.provider.code);
    this.error.set('');
    this.svc.testConnection(v.provider.code, this.entityId()).subscribe({
      // keel returns HTTP 200 with {status:'error', message} for a failed test —
      // surface the message, then reload to reflect the status it just recorded.
      next: (res) => {
        this.busy.set('');
        if (res.status !== 'ok') this.error.set(res.message || 'Connection test failed.');
        this.reload(this.entityId());
      },
      error: (e) => {
        this.busy.set('');
        this.error.set(this.msg(e, 'Could not test the connection.'));
      },
    });
  }

  disconnect(v: OAuthConnectionView): void {
    if (!v.connection?.Id) return;
    this.busy.set(v.provider.code);
    this.svc.disconnect(v.connection.Id).subscribe({
      next: () => {
        this.busy.set('');
        this.disconnected.emit(v.provider.code);
        this.reload(this.entityId());
      },
      error: (e) => {
        this.busy.set('');
        this.error.set(this.msg(e, 'Could not disconnect.'));
      },
    });
  }

  protected redirect(url: string): void {
    window.location.href = url;
  }

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { detail?: string; message?: string } };
    return err?.error?.detail ?? err?.error?.message ?? fallback;
  }
}
