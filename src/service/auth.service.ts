import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { map, take, tap } from 'rxjs/operators';
import { ApplicationData, AuthSummary, ConfirmRegisterResponse, DictionaryPath, LoginResponse2FA, PartnerRegistration, RestReport, TableDefinition, TrustedDevice, TwoFactorSetupResponse, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from '../model/appdata';
import {
  LoginResponseSocial,
  OtpRequest, OtpResendRequest, OtpResponse, OtpVerifyRequest, OtpVerifyResponse,
  PushPlatform, PushRegisterRequest,
  ReauthCredentials,
  SignupConsent, SocialLoginRequest, SocialProvider,
} from '../model/auth';
import { RestURL } from './rest_url';
import { Observable, ReplaySubject } from 'rxjs';
import { ApplicationMenu, ConstantValue } from '../model/common';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../config';
import { BaseRestService } from './base_rest.service';

@Injectable()
export abstract class BaseAuthService extends BaseRestService {
  protected readonly router = inject(Router);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  protected cache!: ApplicationData;
  private readonly appData$ = new ReplaySubject<ApplicationData>(1);
  private readonly authIndex = new Map<string, AuthSummary[]>();

  protected readonly appdataUrl                = this.url(RestURL.appdataURL);
  protected readonly loginUrl                  = this.url(RestURL.loginURL);
  protected readonly registerUrl               = this.url(RestURL.registerURL);
  protected readonly chpassUrl                 = this.url(RestURL.chpassURL);
  protected readonly confirmRegisterUrl        = this.url(RestURL.confirmRegisterURL);
  protected readonly confirmChpassUrl          = this.url(RestURL.confirmChpassURL);
  protected readonly loginGoogleUrl            = this.url(RestURL.loginGoogleURL);
  protected readonly twoFactorSetupUrl         = this.url(RestURL.twoFactorSetupURL);
  protected readonly twoFactorVerifyUrl        = this.url(RestURL.twoFactorVerifyURL);
  protected readonly twoFactorDisableUrl       = this.url(RestURL.twoFactorDisableURL);
  protected readonly twoFactorLoginVerifyUrl   = this.url(RestURL.twoFactorLoginVerifyURL);
  protected readonly twoFactorBackupVerifyUrl  = this.url(RestURL.twoFactorBackupVerifyURL);
  protected readonly trustedDeviceListUrl      = this.url(RestURL.trustedDeviceListURL);
  protected readonly trustedDeviceRegisterUrl  = this.url(RestURL.trustedDeviceRegisterURL);
  protected readonly trustedDeviceRevokeUrl    = this.url(RestURL.trustedDeviceRevokeURL);
  protected readonly otpSendUrl                = this.url(RestURL.otpSendURL);
  protected readonly otpVerifyUrl              = this.url(RestURL.otpVerifyURL);
  protected readonly otpResendUrl              = this.url(RestURL.otpResendURL);
  protected readonly loginSocialUrl            = this.url(RestURL.loginSocialURL);
  protected readonly logoutEverywhereUrl       = this.url(RestURL.logoutEverywhereURL);
  protected readonly deleteAccountUrl          = this.url(RestURL.deleteAccountURL);
  protected readonly pushRegisterUrl           = this.url(RestURL.pushRegisterURL);
  protected readonly pushRevokeUrl             = this.url(RestURL.pushRevokeURL);

  token: string | null = null;
  readonly isLoggedIn = signal(false);

  /**
   * Multi-role app support. Consumers that distinguish rider/driver/admin
   * (or any equivalent split) call setRole() after login, then
   * navigateToRoleHome({...}) to route to the per-role landing page. The
   * value is persisted in localStorage so the role survives a refresh.
   *
   * Single-role consumers (default) leave currentRole untouched; the
   * signal stays null and these helpers are never called.
   */
  readonly currentRole: WritableSignal<string | null> = signal(localStorage.getItem('userRole'));

  /** Persist role to localStorage and update the signal. */
  setRole(role: string): void {
    if (!role) return;
    localStorage.setItem('userRole', role);
    this.currentRole.set(role);
  }

  /** Drop the persisted role. Called by logout(); also exposed for explicit "clear role" UX. */
  clearRole(): void {
    localStorage.removeItem('userRole');
    this.currentRole.set(null);
  }

  /**
   * Navigate to the home route for the currently-set role. roleHomeMap
   * maps role names → URL paths (e.g. `{ rider: '/rider/home', driver:
   * '/driver/home', admin: '/admin' }`). Falls back to '/' when no role
   * is set or when the map has no entry for the current role.
   */
  navigateToRoleHome(roleHomeMap: Record<string, string>): void {
    const role = this.currentRole();
    const target = role ? roleHomeMap[role] : null;
    this.router.navigateByUrl(target ?? '/');
  }

  loadAppData() {
    this.http.get<ApplicationData>(this.appdataUrl).pipe(
        tap((data) => {
            this.cache = data;
            this.buildAuthIndex();
        }),
    ).subscribe((data: ApplicationData) => this.appData$.next(data));
  }

  private completeLogin(token: string) {
    this.token = token;
    this.isLoggedIn.set(true);
    localStorage.setItem('jwt', token);
    this.loadAppData();
    this.initRoutes();
  }

  login(username: string, password: string) {
    // withCredentials so the browser sends the server-set `keel_td` cookie
    // (keel v0.9 trusted-device secret). When it maps to a trusted row, keel
    // skips 2FA. The old client-supplied `deviceFingerprint` field is gone.
    this.http.post<LoginResponse2FA>(this.loginUrl, { username, password }, { withCredentials: true }).subscribe({
        next: (res) => {
            if (res.twoFactorRequired && res.loginToken) {
                localStorage.setItem('loginToken', res.loginToken);
                this.router.navigate(['/login/2fa']);
            } else {
                this.completeLogin(res.token);
            }
        },
        error: (err) => {
            console.error('Login failed:', err);
        },
    });
  }

  loginWithGoogle(code: string, redirectUri?: string) {
    this.http.post<LoginResponse2FA>(this.loginGoogleUrl, { code, redirectUri }, { withCredentials: true }).subscribe({
        next: (res) => {
            if (res.twoFactorRequired && res.loginToken) {
                localStorage.setItem('loginToken', res.loginToken);
                this.router.navigate(['/login/2fa']);
            } else {
                this.completeLogin(res.token);
            }
        },
        error: (err) => {
            console.error('Google login failed:', err);
        },
    });
  }

  // ── 2FA Methods ──

  /**
   * Generate a fresh TOTP seed + 10 backup codes. Requires recent
   * re-authentication — pass either current `password` or current
   * `twoFactorCode` (one of them is mandatory). Server-side rotation
   * revokes all active refresh tokens.
   */
  setup2FA(reauth: ReauthCredentials) {
    return this.http.post<TwoFactorSetupResponse>(this.twoFactorSetupUrl, reauth);
  }

  /** Confirm a freshly-set TOTP seed by verifying a code (authenticated). */
  verify2FA(request: TwoFactorVerifyRequest) {
    return this.http.post<TwoFactorVerifyResponse>(this.twoFactorVerifyUrl, request);
  }

  /**
   * Verify a TOTP code during the LOGIN flow (public endpoint). Uses `/public/2fa/verify`
   */
  verify2FALogin(code: string, trustDevice = false, deviceName?: string) {
    const loginToken = localStorage.getItem('loginToken');
    if (!loginToken) {
        console.error('No login token found');
        return;
    }
    const request: TwoFactorVerifyRequest = {
        code,
        loginToken,
        trustDevice,
        deviceName,
    };
    // withCredentials so the browser stores the `keel_td` cookie keel sets on
    // a `trustDevice:true` verify — that cookie is what skips 2FA next login.
    this.http.post<TwoFactorVerifyResponse>(this.twoFactorLoginVerifyUrl, request, { withCredentials: true }).subscribe({
        next: (res) => {
            if (res.valid && res.token) {
                localStorage.removeItem('loginToken');
                this.completeLogin(res.token);
            }
        },
        error: (err) => {
            console.error('2FA verification failed:', err);
        },
    });
  }

  /** Verify a single-use backup code during the LOGIN flow (public endpoint). */
  verifyBackupCode(code: string) {
    const loginToken = localStorage.getItem('loginToken');
    return this.http.post<TwoFactorVerifyResponse>(this.twoFactorBackupVerifyUrl, { code, loginToken }, { withCredentials: true });
  }

  /**
   * Disable 2FA. Requires BOTH current password AND current TOTP `code`.
   * Server-side revokes all active refresh tokens.
   */
  disable2FA(password: string, code: string) {
    return this.http.post<{ message: string }>(this.twoFactorDisableUrl, { password, code });
  }

  // ── Trusted Device Methods ──

  getTrustedDevices() {
    return this.http.get<TrustedDevice[]>(this.trustedDeviceListUrl);
  }

  revokeTrustedDevice(deviceId: number) {
    return this.http.post<{ message: string }>(this.trustedDeviceRevokeUrl, { deviceId });
  }

  chpass(username: string, new_password: string, old_password: string) {
    return this.http.post<{ message: string }>(this.chpassUrl, { username, old_password, new_password });
  }

  forgotPassword(username: string) {
    return this.http.post<{ message: string }>(this.chpassUrl, { username });
  }

  confirmRegister(email: string, code: string) {
    const params = new HttpParams().set('email', email).set('code', code);
    return this.http.post<ConfirmRegisterResponse>(this.confirmRegisterUrl, null, { params });
  }

  confirmChpass(username: string, code: string, new_password: string) {
    return this.http.post<{ message: string }>(this.confirmChpassUrl, { username, code, new_password });
  }

  loadStoredSession() {
    this.token = localStorage.getItem('jwt');
    if (this.token) {
      this.isLoggedIn.set(true);
      this.loadAppData();
      this.initRoutes();
    }
  }

  logout() {
    this.token = null;
    this.isLoggedIn.set(false);
    localStorage.removeItem('jwt');
    localStorage.removeItem('menu');
    this.clearRole();
    this.router.navigate(['/login/local'], { queryParams: { loggedOut: 'true' } });
  }

  register(reg: PartnerRegistration) {
    return this.http.post<PartnerRegistration>(this.registerUrl, reg);
  }

  // ── Phone / email OTP ──
  // Override in subclasses to add project-specific behaviour (e.g. routing the
  // JWT into rider vs driver session state). Default implementations call the
  // keel endpoints directly.

  /**
   * Send an OTP to a phone or email contact. `contactType` is a frontend-only
   * field used by callers to drive UI navigation; it is stripped before
   * posting because keel rejects unknown JSON fields with 400.
   *
   * The response is `{ otpToken }` — an opaque server-issued token (32 random
   * bytes, base64-URL) bound to the user_id in keel's cache for ~5 minutes.
   * Echo it back to verifyOtp / resendOtp. On unknown contacts the login
   * fall-through still returns 200 with a token (no SMS dispatched), so the
   * response shape is identical and an attacker cannot enumerate registered
   * numbers by comparing 200 vs 404.
   */
  sendOtp(req: OtpRequest): Observable<OtpResponse> {
    // Send the request as-is — `contactType` is now a real backend
    // field (keel v0.5.11+) that selects the SMS-vs-email dispatch
    // channel. The pre-v0.5.11 strip-before-post workaround was
    // removed when email-OTP support landed in keel/handler/
    // otp_handler.go.
    return this.http.post<OtpResponse>(this.otpSendUrl, req);
  }

  resendOtp(otpToken: string, purpose?: OtpRequest['purpose']): Observable<{ status: string }> {
    const req: OtpResendRequest = { otpToken, purpose };
    return this.http.post<{ status: string }>(this.otpResendUrl, req);
  }

  /**
   * Verify an OTP and complete login. The optional `role` argument is
   * persisted on success so multi-role consumers (rider/driver/admin)
   * can route to the right landing screen after the JWT lands. When
   * omitted (single-role apps), the role stays unchanged.
   */
  verifyOtp(req: OtpVerifyRequest, role?: string): Observable<OtpVerifyResponse> {
    return this.http.post<OtpVerifyResponse>(this.otpVerifyUrl, req).pipe(
      tap((res) => {
        if (res?.token) {
          this.completeLogin(res.token);
          if (role) this.setRole(role);
        }
      }),
    );
  }

  // ── Social login (ID token flow) ──
  // Distinct from the older loginWithGoogle(code) OAuth-code flow, which
  // remains for backward compatibility. Prefer loginSocial for new code.

  loginSocial(
    provider: SocialProvider,
    idToken: string,
    consent?: SignupConsent,
  ): Observable<LoginResponseSocial> {
    const payload: SocialLoginRequest = { provider, token: idToken, ...consent };
    return this.http.post<LoginResponseSocial>(this.loginSocialUrl, payload).pipe(
      tap((res) => { if (res?.token) this.completeLogin(res.token); }),
    );
  }

  // ── Account lifecycle ──

  /**
   * Soft-delete the caller's account. Requires recent re-authentication —
   * pass current `password` and/or `twoFactorCode`. Server anonymizes
   * user_account, revokes all tokens / trusted devices / social links.
   * Clears local session on success.
   */
  deleteAccount(reauth: ReauthCredentials, reason?: string): Observable<void> {
    const body = { ...reauth, reason };
    return this.http.request<void>('DELETE', this.deleteAccountUrl, { body }).pipe(
      tap(() => this.clearSession()),
    );
  }

  /**
   * Revoke every active refresh token for this user (sign out everywhere).
   * Requires recent re-authentication — pass current `password` and/or
   * `twoFactorCode`.
   */
  logoutEverywhere(reauth: ReauthCredentials): Observable<void> {
    return this.http.post<void>(this.logoutEverywhereUrl, reauth);
  }

  // ── Push token registration ──

  registerPushToken(
    platform: PushPlatform,
    token: string,
    appVersion?: string,
    deviceModel?: string,
  ): Observable<void> {
    const req: PushRegisterRequest = { platform, token, appVersion, deviceModel };
    return this.http.post<void>(this.pushRegisterUrl, req);
  }

  revokePushToken(token: string): Observable<void> {
    return this.http.post<void>(this.pushRevokeUrl, { token });
  }

  /** Clear in-memory + localStorage session without triggering a navigation. */
  protected clearSession() {
    this.token = null;
    this.isLoggedIn.set(false);
    localStorage.removeItem('jwt');
    localStorage.removeItem('menu');
  }

  private buildAuthIndex() {
    this.authIndex.clear();
    for (const auth of this.cache.Permissions) {
        const obj = auth.AuthorizationObjectId ?? (auth as any).ObjectName;
        const act = auth.Action;
        const low = auth.LowLimit ?? (auth as any).Low;
        if (!obj || !act || !low) continue;
        const key = obj + '|' + act;
        if (!this.authIndex.has(key)) {
            this.authIndex.set(key, []);
        }
        const reg = low
            .replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
            .replace(/\\\*/g, '.*')
            .replace(/\\\?/g, '.');
        this.authIndex.get(key)!.push({
            Obj: obj,
            Act: act,
            Val: low,
            Reg: reg,
        } as AuthSummary);
    }
  }

  private checkPermission(authorityObjectId: string, activity: string, value: string): boolean {
    if (!this.cache || !this.cache.Permissions) {
        return false;
    }
    const key = authorityObjectId + '|' + activity;
    const auths = this.authIndex.get(key);
    if (!auths) {
        return false;
    }
    for (const auth of auths) {
        if (new RegExp(`^${auth.Reg}$`).test(value)) {
            return true;
        }
    }
    return false;
  }

  getAppData() {
    return this.appData$.asObservable();
  }

  getDomainValues(domainName: string): ConstantValue[] | undefined {
    if (!this.cache || !this.cache.ConstantCache || !this.cache.ConstantCache[domainName]) {
        return undefined;
    }
    const opField = this.guiConfig.opField;
    const domainMap = this.cache.ConstantCache[domainName];
    return Object.keys(domainMap).map((key) => ({
        ConstantId: domainName,
        Value: key,
        Caption: domainMap[key],
        [opField]: 'S',
    } as unknown as ConstantValue));
  }

  getTableValues(tableName: string): ConstantValue[] | undefined {
    if (!this.cache || !this.cache.TableCache || !this.cache.TableCache[tableName]) {
        return undefined;
    }
    const opField = this.guiConfig.opField;
    const tableMap = this.cache.TableCache[tableName];
    return Object.keys(tableMap).map((key) => ({
        ConstantId: tableName,
        Value: key,
        Caption: tableMap[key],
        [opField]: 'S',
    } as unknown as ConstantValue));
  }

  getMenus(): Observable<ApplicationMenu[]> {
    return this.appData$.pipe(map((data: ApplicationData) => data?.MainMenu ?? []));
  }

  getTableDefinition(tableName: string): TableDefinition | undefined {
    if (!this.cache || !this.cache.TableDefinitions) {
      return undefined;
    }
    return this.cache.TableDefinitions[tableName];
  }

  getApiDictionary(dictionaryId: string): DictionaryPath | undefined {
    if (!this.cache || !this.cache.Apis) {
      return undefined;
    }
    return this.cache.Apis[dictionaryId];
  }

  /**
   * keel emits Reports as `map[string]*RestReport` which serializes to a
   * JSON object keyed by report id, not an array. The previous cast to
   * `RestReport[]` was a type lie that produced an empty iteration in
   * practice. Object.values is the correct unwrap.
   */
  getReports(): RestReport[] {
    const reports = this.cache?.['Reports'] as Record<string, RestReport> | undefined;
    return reports ? Object.values(reports) : [];
  }

  /**
   * Look up a single report by its id (e.g. 'scorecard' for /api/v1/analytic/scorecard).
   * Returns undefined if Reports cache is missing or the id isn't registered.
   */
  getReport(id: string): RestReport | undefined {
    const reports = this.cache?.['Reports'] as Record<string, RestReport> | undefined;
    return reports?.[id];
  }

  canRead(tableName: string)   { return this.checkPermission('TABLE', 'SELECT', tableName); }
  canCreate(tableName: string) { return this.checkPermission('TABLE', 'INSERT', tableName); }
  canUpdate(tableName: string) { return this.checkPermission('TABLE', 'UPDATE', tableName); }
  canDelete(tableName: string) { return this.checkPermission('TABLE', 'DELETE', tableName); }
  /**
   * Authorization check for a custom TableAction. authorityObject is the
   * uppercased table_name; activity is the uppercased action_name. The
   * grant's low_limit is checked against the table_name (lowercase) —
   * matching the convention populated by keel's loadTableActions.
   */
  canExecute(authorityObject: string, activity: string, tableName: string): boolean {
    return this.checkPermission(authorityObject, activity, tableName);
  }
  canAccess(pageName: string)  { return this.checkPermission('PAGE', 'ACCESS', pageName); }
  canReport(reportName: string) { return this.checkPermission('REPORT', 'ACCESS', reportName); }

  readonly canActivate: CanActivateFn = (route) => {
    return this.getAppData().pipe(
      map(() => {
        const path = route.routeConfig?.path;
        if (!path) return true;
        const allowed = this.canAccess(path.split('/')[0]);
        if (!allowed) {
          console.warn(`[canActivate] access denied for: ${path}`);
          this.router.navigate(['/dashboard']);
        }
        return allowed;
      }),
    );
  };

  /** Override in subclasses to add project-specific routes */
  protected buildExtraRoutes(data: ApplicationData): Routes {
    if (this.guiConfig.extraRoutes) {
      return this.guiConfig.extraRoutes(data);
    }
    return [];
  }

  private getRouteOverride(restUri: string): import('@angular/core').Type<unknown> | undefined {
    const overrides = this.guiConfig.menuItemRouteOverrides;
    if (!overrides) return undefined;
    if (overrides[restUri]) return overrides[restUri];
    for (const pattern of Object.keys(overrides)) {
      if (pattern.endsWith('/*') && restUri.startsWith(pattern.slice(0, -1))) {
        return overrides[pattern];
      }
    }
    return undefined;
  }

  async initRoutes() {
    // Lazy imports to break circular dependency:
    // auth.service → TableSearch/TableList → BaseTable → auth.service
    const { TableSearch } = await import('../component/table/table_search');
    const { TableList } = await import('../component/table/table_list');
    const { TableReport } = await import('../component/table/table_report');

    this.getAppData().pipe(take(1)).subscribe({
        next: (data: ApplicationData) => {
            const menus = data.MainMenu ?? [];
            const apis  = data.Apis;

            const publicRoutes = this.guiConfig.publicRoutes ?? [];
            const dashboardComponent = this.guiConfig.dashboardComponent;
            const extraRoutes = this.buildExtraRoutes(data);

            const newRoutes: Routes = [
                { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
                ...publicRoutes,
                ...extraRoutes,
            ];

            if (dashboardComponent) {
                newRoutes.push({ path: 'dashboard', component: dashboardComponent });
            }

            for (const menu of menus) {
                if (!menu.Id || !menu.ApplicationMenuItems) continue;
                const menuPath = menu.Id.toLowerCase();
                const children: Routes = [];

                for (const page of menu.ApplicationMenuItems) {
                    if (!page.ItemId) continue;
                    const restUri = page.RestUri ?? '';
                    const api = apis?.[restUri];
                    const apiName = restUri; // bare RestUri; BackendService.crudUrl resolves the version
                    const tableName = api?.Table?.TableName ?? restUri;

                    const overrideComponent = this.getRouteOverride(restUri);
                    if (overrideComponent) {
                        children.push({
                            path: page.ItemId,
                            component: overrideComponent,
                            canActivate: [this.canActivate],
                            data: { tableName, apiName },
                        });
                    } else if (this.getReport(page.ItemId)) {
                        // Menu item id matches a row in rest_report_header →
                        // render with TableReport. Report endpoints don't go
                        // through the metadata-driven CRUD layer (apis cache),
                        // so apiName here is just restUri (e.g. analytic/scorecard).
                        children.push({
                            path: page.ItemId,
                            component: TableReport,
                            canActivate: [this.canActivate],
                            data: { tableName, apiName },
                        });
                    } else if (page.FilterOnList) {
                        children.push({
                            path: page.ItemId,
                            component: TableSearch,
                            canActivate: [this.canActivate],
                            data: {
                                tableName,
                                apiName,
                                targetRoute: menuPath + '/' + page.ItemId + '/list',
                            },
                        });
                        children.push({
                            path: page.ItemId + '/list',
                            component: TableList,
                            canActivate: [this.canActivate],
                            data: { tableName, apiName },
                        });
                    } else {
                        children.push({
                            path: page.ItemId,
                            component: TableList,
                            canActivate: [this.canActivate],
                            data: { tableName, apiName },
                        });
                    }
                }

                newRoutes.push({ path: menuPath, children });
            }

            newRoutes.push({ path: '**', redirectTo: 'dashboard' });
            this.router.resetConfig(newRoutes);
            this.router.navigate(['/dashboard']);
        },
        error: (err) => {
            console.error('initRoutes failed:', err);
        },
    });
  }
}
