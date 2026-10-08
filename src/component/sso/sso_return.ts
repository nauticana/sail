import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { DEFAULT_CONFIG, SAIL_GUI_CONFIG, SailGuiConfig } from '../../config';
import { ApplicationData } from '../../model/appdata';
import { BaseAuthService } from '../../service/auth.service';
import { ssoErrorMessage } from '../../util/sso';

type SsoReturnState = 'signing-in' | 'error' | 'test-passed' | 'test-failed';

/**
 * keel's single sign-on return URL (`SSOHandler.FrontendReturnURL`), routed by the
 * app at `login/sso`. A `code` is exchanged once and removed from the address bar;
 * `error` and `test` stay so the outcome survives the post-login route rebuild.
 *
 * Selector: <sail-sso-return>
 */
@Component({
  selector: 'sail-sso-return',
  templateUrl: './sso_return.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink],
})
export class SsoReturnComponent {
  private readonly auth = inject(BaseAuthService);
  private readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, { optional: true }) ?? DEFAULT_CONFIG;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<SsoReturnState>('signing-in');
  protected readonly message = signal('');
  /** The identity provider screen from the menu metadata, once the app data is loaded. */
  protected readonly adminRoute = toSignal(
    this.auth.getAppData().pipe(map(identityProviderRoute), catchError(() => of(null))),
    { initialValue: null },
  );

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const location = inject(Location);
    const code = params.get('code');
    const test = params.get('test');
    if (code) {
      location.replaceState(location.path().split('?')[0]);
      this.exchange(code);
    } else if (test === 'passed' || test === 'failed') {
      this.state.set(test === 'passed' ? 'test-passed' : 'test-failed');
      if (test === 'failed') this.message.set(this.messageFor(params.get('error')));
      this.auth.setLanding(location.path());
      this.destroyRef.onDestroy(() => this.auth.setLanding(null));
    } else if (params.has('error')) {
      this.fail(params.get('error'));
    } else {
      inject(Router).navigate(['/login/local'], { replaceUrl: true });
    }
  }

  private exchange(code: string): void {
    this.auth.exchangeHandoff(code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      error: () => this.fail('sso_failed'),
    });
  }

  private fail(code: string | null): void {
    this.state.set('error');
    this.message.set(this.messageFor(code));
  }

  private messageFor(code: string | null): string {
    return ssoErrorMessage(code, this.guiConfig.ssoErrorMessages);
  }
}

function identityProviderRoute(data: ApplicationData): string | null {
  for (const menu of data.MainMenu ?? []) {
    const item = menu.ApplicationMenuItems?.find((i) => i.RestUri === 'partner_identity_provider');
    if (menu.Id && item?.ItemId) return `/${menu.Id.toLowerCase()}/${item.ItemId}`;
  }
  return null;
}
