import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { filter, map, mergeMap, take, tap } from 'rxjs/operators';
import { ApplicationData, ConfirmRegisterResponse, DictionaryPath, LoginResponse2FA, PartnerRegistration, RestReport, TableDefinition, TrustedDevice, TwoFactorSetupResponse, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from '../model/appdata';
import {
  LoginResponseSocial,
  OtpRequest, OtpResendRequest, OtpResponse, OtpVerifyRequest, OtpVerifyResponse,
  PushPlatform, PushRegisterRequest,
  ReauthCredentials,
  SignupConsent, SocialLoginRequest, SocialProvider,
  UserProfile,
} from '../model/auth';
import { RestURL } from './rest_url';
import { Observable, ReplaySubject, catchError, defer, merge, of, throwError } from 'rxjs';
import { ApplicationMenu, ConstantValue } from '../model/common';
import { CanActivateFn, CanDeactivateFn, Router, Routes } from '@angular/router';
import { SAIL_GUI_CONFIG, SailGuiConfig, DEFAULT_CONFIG } from '../config';
import { BaseRestService } from './base_rest.service';
import { registerSessionExpiredHandler, resetAuthCircuit } from './auth.interceptor';

/** Sort dropdown options by their visible label so long lookup lists are scannable. */
const byCaption = (a: ConstantValue, b: ConstantValue) =>
  (a.Caption ?? '').localeCompare(b.Caption ?? '', undefined, { numeric: true, sensitivity: 'base' });

/** One grant in the permission index — pattern compiled once at appdata load, not per check. */
interface CompiledPermission {
  Obj: string;
  Act: string;
  Val: string;
  Rx: RegExp;
}

/** Permission row as keel emits it; ObjectName/Low are the legacy field names. */
interface PermissionRow {
  AuthorizationObjectId?: string;
  ObjectName?: string;
  Action?: string;
  LowLimit?: string;
  Low?: string;
}

@Injectable()
export abstract class BaseAuthService extends BaseRestService {
  protected readonly router = inject(Router);
  protected readonly guiConfig: SailGuiConfig = inject(SAIL_GUI_CONFIG, {optional: true}) ?? DEFAULT_CONFIG;
  protected cache?: ApplicationData;
  private appData$ = new ReplaySubject<ApplicationData>(1);
  private appDataFail$ = new ReplaySubject<unknown>(1);
  private readonly authIndex = new Map<string, CompiledPermission[]>();
  /** The route config active before the first initRoutes() — restored on logout
   *  so the login screen doesn't keep the previous user's route tree. */
  private preLoginRoutes: Routes | null = null;

  constructor() {
    super();
    registerSessionExpiredHandler(() => this.onSessionExpired());
  }

  // Lazy getters, not field initializers: fields would snapshot during super(),
  // before a subclass constructor can call configureRestUrls().
  protected get appdataUrl()               { return this.url(RestURL.appdataURL); }
  protected get loginUrl()                 { return this.url(RestURL.loginURL); }
  protected get registerUrl()              { return this.url(RestURL.registerURL); }
  protected get chpassUrl()                { return this.url(RestURL.chpassURL); }
  protected get confirmRegisterUrl()       { return this.url(RestURL.confirmRegisterURL); }
  protected get confirmChpassUrl()         { return this.url(RestURL.confirmChpassURL); }
  protected get loginGoogleUrl()           { return this.url(RestURL.loginGoogleURL); }
  protected get twoFactorSetupUrl()        { return this.url(RestURL.twoFactorSetupURL); }
  protected get twoFactorVerifyUrl()       { return this.url(RestURL.twoFactorVerifyURL); }
  protected get twoFactorDisableUrl()      { return this.url(RestURL.twoFactorDisableURL); }
  protected get twoFactorLoginVerifyUrl()  { return this.url(RestURL.twoFactorLoginVerifyURL); }
  protected get twoFactorBackupVerifyUrl() { return this.url(RestURL.twoFactorBackupVerifyURL); }
  protected get trustedDeviceListUrl()     { return this.url(RestURL.trustedDeviceListURL); }
  protected get trustedDeviceRegisterUrl() { return this.url(RestURL.trustedDeviceRegisterURL); }
  protected get trustedDeviceRevokeUrl()   { return this.url(RestURL.trustedDeviceRevokeURL); }
  protected get otpSendUrl()               { return this.url(RestURL.otpSendURL); }
  protected get otpVerifyUrl()             { return this.url(RestURL.otpVerifyURL); }
  protected get otpResendUrl()             { return this.url(RestURL.otpResendURL); }
  protected get loginSocialUrl()           { return this.url(RestURL.loginSocialURL); }
  protected get logoutEverywhereUrl()      { return this.url(RestURL.logoutEverywhereURL); }
  protected get deleteAccountUrl()         { return this.url(RestURL.deleteAccountURL); }
  protected get pushRegisterUrl()          { return this.url(RestURL.pushRegisterURL); }
  protected get pushRevokeUrl()            { return this.url(RestURL.pushRevokeURL); }
  protected get profileUrl()               { return this.url(RestURL.profileURL); }
  protected get profileEmailUrl()          { return this.url(RestURL.profileEmailURL); }
  protected get profileEmailConfirmUrl()   { return this.url(RestURL.profileEmailConfirmURL); }
  protected get profilePhoneUrl()          { return this.url(RestURL.profilePhoneURL); }
  protected get profilePhoneConfirmUrl()   { return this.url(RestURL.profilePhoneConfirmURL); }

  token: string | null = null;
  readonly isLoggedIn = signal(false);

  /** Last appdata load failure (null when none). */
  readonly appDataError = signal<unknown>(null);

  /** Bumped on cache load/clear so computed()s over the non-reactive `cache` recompute. */
  readonly appDataVersion = signal(0);

  /** Set when the OAuth session-cookie handoff fails; the UI shows it and lets the
   *  user retry instead of being redirected into a cookieless login loop. */
  readonly sessionHandoffError = signal<string | null>(null);

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
    this.appDataError.set(null);
    this.http.get<ApplicationData>(this.appdataUrl).subscribe({
        next: (data) => {
            this.cache = data;
            this.buildAuthIndex();
            this.appDataVersion.update((v) => v + 1);
            this.appData$.next(data);
        },
        error: (err) => {
            console.error('loadAppData failed:', err);
            this.appDataError.set(err);
            this.appDataFail$.next(err);
        },
    });
  }

  /** Adopt an externally-minted JWT (registration/SSO handoff flows) and run the
   * full post-login sequence — store under the canonical key, load appdata, init
   * routes. Apps must use this instead of writing localStorage directly. */
  acceptToken(token: string) {
    this.completeLogin(token);
  }

  private completeLogin(token: string) {
    this.token = token;
    this.isLoggedIn.set(true);
    localStorage.setItem('jwt', token);
    resetAuthCircuit(); // a new session must not inherit a prior session's open circuit
    const ret = this.validatedReturnUrl();
    if (ret && this.guiConfig.sessionCookieUrl) {
      // OAuth flow: mirror the bearer into a cookie, then hand off to the
      // (cross-origin) authorization server via a full navigation. Only hand off
      // once the cookie is actually set — redirecting after a failed cookie request
      // sends the user on without a session and loops them back to login.
      this.sessionHandoffError.set(null);
      this.http.post(this.url(this.guiConfig.sessionCookieUrl), {}, { withCredentials: true })
          .pipe(take(1))
          .subscribe({
            next: () => window.location.assign(ret),
            error: (err) => {
              console.error('Session cookie handoff failed:', err);
              this.sessionHandoffError.set('Could not complete sign-in. Please try again.');
            },
          });
      return;
    }
    this.loadAppData();
    this.initRoutes();
  }

  /** A post-login `?return=` URL, only when its host is in allowedReturnHosts and
   * the scheme is https (or loopback) — an open-redirect guard. '' otherwise. */
  private validatedReturnUrl(): string {
    const raw = new URLSearchParams(window.location.search).get('return');
    if (!raw) return '';
    try {
      const u = new URL(raw, window.location.origin);
      if (u.username || u.password) return '';   // reject userinfo ("user@host") spoofing
      const host = u.hostname.toLowerCase();
      const okScheme = u.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
      const allowed = (this.guiConfig.allowedReturnHosts ?? []).some((h) => h.toLowerCase() === host);
      if (okScheme && allowed) {
        return u.toString();
      }
    } catch { /* malformed → reject */ }
    return '';
  }

  /** Route a login response: into the 2FA step when required, else complete the login. */
  private handleLoginResponse(res: LoginResponse2FA): void {
    if (res.twoFactorRequired && res.loginToken) {
        localStorage.setItem('loginToken', res.loginToken);
        this.router.navigate(['/login/2fa']);
    } else {
        this.completeLogin(res.token);
    }
  }

  /**
   * POST credentials; success completes the login (or routes to 2FA). Callers
   * subscribe and handle the error channel to surface failures in the UI.
   * withCredentials sends keel's `keel_td` trusted-device cookie (skips 2FA).
   */
  login(username: string, password: string): Observable<LoginResponse2FA> {
    return this.http.post<LoginResponse2FA>(this.loginUrl, { username, password }, { withCredentials: true }).pipe(
        tap((res) => this.handleLoginResponse(res)),
    );
  }

  /** OAuth-code Google login; same contract as login(). */
  loginWithGoogle(code: string, redirectUri?: string): Observable<LoginResponse2FA> {
    return this.http.post<LoginResponse2FA>(this.loginGoogleUrl, { code, redirectUri }, { withCredentials: true }).pipe(
        tap((res) => this.handleLoginResponse(res)),
    );
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
   * Verify a TOTP code during the LOGIN flow (public endpoint, `/public/2fa/verify`).
   * Returns the response so callers can drive loading / invalid-code UI; on a
   * valid code the login is completed (token stored, app data + routes loaded).
   * withCredentials so the browser stores the `keel_td` cookie keel sets on a
   * `trustDevice:true` verify — that cookie is what skips 2FA next login.
   */
  verify2FALogin(code: string, trustDevice = false, deviceName?: string): Observable<TwoFactorVerifyResponse> {
    const request: TwoFactorVerifyRequest = {
        code,
        loginToken: localStorage.getItem('loginToken') ?? '',
        trustDevice,
        deviceName,
    };
    return this.http.post<TwoFactorVerifyResponse>(this.twoFactorLoginVerifyUrl, request, { withCredentials: true }).pipe(
        tap((res) => {
            if (res.valid && res.token) {
                localStorage.removeItem('loginToken');
                this.completeLogin(res.token);
            }
        }),
    );
  }

  /** Verify a login-flow backup code; a valid code completes the login (same contract as verify2FALogin). */
  verifyBackupCode(code: string): Observable<TwoFactorVerifyResponse> {
    const loginToken = localStorage.getItem('loginToken');
    return this.http.post<TwoFactorVerifyResponse>(this.twoFactorBackupVerifyUrl, { code, loginToken }, { withCredentials: true }).pipe(
        tap((res) => {
            if (res.valid && res.token) {
                localStorage.removeItem('loginToken');
                this.completeLogin(res.token);
            }
        }),
    );
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

  // ── Self-service profile (keel ProfileHandler) ──
  // Name/locale apply immediately; email/phone are verify-before-apply: a code
  // is sent to the new value, the change lands only on confirm.

  getProfile() {
    return this.http.get<UserProfile>(this.profileUrl);
  }

  updateProfile(firstName: string, lastName: string, locale: string) {
    return this.http.post<{ message: string }>(this.profileUrl, { firstName, lastName, locale });
  }

  requestEmailChange(value: string) {
    return this.http.post<{ message: string }>(this.profileEmailUrl, { value });
  }

  confirmEmailChange(value: string, code: number) {
    return this.http.post<{ message: string }>(this.profileEmailConfirmUrl, { value, code });
  }

  requestPhoneChange(value: string) {
    return this.http.post<{ message: string }>(this.profilePhoneUrl, { value });
  }

  confirmPhoneChange(value: string, code: number) {
    return this.http.post<{ message: string }>(this.profilePhoneConfirmUrl, { value, code });
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
    this.clearSession();
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
   * Send an OTP to a phone or email contact. `contactType` (keel v0.5.11+)
   * selects the SMS-vs-email dispatch channel and is posted as-is.
   *
   * The response is `{ otpToken }` — an opaque server-issued token (32 random
   * bytes, base64-URL) bound to the user_id in keel's cache for ~5 minutes.
   * Echo it back to verifyOtp / resendOtp. On unknown contacts the login
   * fall-through still returns 200 with a token (no SMS dispatched), so the
   * response shape is identical and an attacker cannot enumerate registered
   * numbers by comparing 200 vs 404.
   */
  sendOtp(req: OtpRequest): Observable<OtpResponse> {
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

  // Single-use nonce for the social id_token flow (replay protection): GET on
  // the same social-login route. Empty only when the backend explicitly hasn't
  // enabled it (404/405); transient failures propagate so replay protection is
  // never silently dropped.
  getSocialNonce(): Observable<string> {
    return this.http.get<{ nonce: string }>(this.loginSocialUrl).pipe(
      map((res) => res?.nonce ?? ''),
      catchError((err: HttpErrorResponse) =>
        (err.status === 404 || err.status === 405) ? of('') : throwError(() => err)),
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

  /** Clear the session without navigating — including cached appdata, grants,
   * and the route tree, so nothing leaks past logout. */
  protected clearSession() {
    this.token = null;
    this.isLoggedIn.set(false);
    localStorage.removeItem('jwt');
    localStorage.removeItem('menu');
    localStorage.removeItem('loginToken');
    this.clearRole();
    this.cache = undefined;
    this.authIndex.clear();
    this.appDataError.set(null);
    this.appDataVersion.update((v) => v + 1);
    // Fresh subjects so stale appdata never replays into the next session.
    this.appData$.complete();
    this.appDataFail$.complete();
    this.appData$ = new ReplaySubject<ApplicationData>(1);
    this.appDataFail$ = new ReplaySubject<unknown>(1);
    if (this.preLoginRoutes) {
      this.router.resetConfig(this.preLoginRoutes);
    }
  }

  /** Auth circuit opened (repeated 401s) — the stored session is dead. */
  protected onSessionExpired(): void {
    if (!this.isLoggedIn()) return;
    this.clearSession();
    this.router.navigate(['/login/local'], { queryParams: { sessionExpired: 'true' } });
  }

  private buildAuthIndex() {
    this.authIndex.clear();
    if (!this.cache?.Permissions) return;
    for (const auth of this.cache.Permissions as PermissionRow[]) {
        const obj = auth.AuthorizationObjectId ?? auth.ObjectName;
        const act = auth.Action;
        const low = auth.LowLimit ?? auth.Low;
        if (!obj || !act || !low) continue;
        const key = obj + '|' + act;
        const reg = low
            .replace(/[.+^${}()|[\]\\*?]/g, '\\$&')
            .replace(/\\\*/g, '.*')
            .replace(/\\\?/g, '.');
        const list = this.authIndex.get(key) ?? [];
        list.push({ Obj: obj, Act: act, Val: low, Rx: new RegExp(`^${reg}$`) });
        this.authIndex.set(key, list);
    }
  }

  private checkPermission(authorityObjectId: string, activity: string, value: string): boolean {
    if (!this.cache) {
        return false;
    }
    const auths = this.authIndex.get(authorityObjectId + '|' + activity);
    return !!auths && auths.some((auth) => auth.Rx.test(value));
  }

  /** Appdata stream. Errors on load failure while nothing is cached yet, so
   * waiters fail loudly instead of hanging; defer binds to the current session's subjects. */
  getAppData(): Observable<ApplicationData> {
    return defer(() => {
      const failures = this.appDataFail$.pipe(
        filter(() => !this.cache),
        mergeMap((err) => throwError(() => err)),
      );
      return merge(this.appData$, failures);
    });
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
    } as unknown as ConstantValue)).sort(byCaption);
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
    } as unknown as ConstantValue)).sort(byCaption);
  }

  /** Menu stream for navigation UIs; never errors (failures surface via appDataError). */
  getMenus(): Observable<ApplicationMenu[]> {
    return defer(() => this.appData$).pipe(map((data: ApplicationData) => data?.MainMenu ?? []));
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
   * keel emits Reports as `map[string]*RestReport` — a JSON object keyed by
   * report id, not an array. Object.values is the correct unwrap.
   */
  getReports(): RestReport[] {
    return this.cache?.Reports ? Object.values(this.cache.Reports) : [];
  }

  /**
   * Look up a single report by its id (e.g. 'scorecard' for /api/v1/analytic/scorecard).
   * Returns undefined if Reports cache is missing or the id isn't registered.
   */
  getReport(id: string): RestReport | undefined {
    return this.cache?.Reports?.[id];
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
      take(1),
      map(() => {
        const path = route.routeConfig?.path;
        if (!path) return true;
        if (this.canAccess(path.split('/')[0])) return true;
        console.warn(`[canActivate] access denied for: ${path}`);
        return this.router.parseUrl('/dashboard');
      }),
      // appdata failed to load — the session is unusable; land on login.
      catchError(() => of(this.router.parseUrl('/login/local'))),
    );
  };

  // Confirms navigation away when the routed component reports unsaved changes.
  // Opt in by implementing hasUnsavedChanges(): boolean on the component.
  readonly canDeactivate: CanDeactivateFn<{ hasUnsavedChanges?: () => boolean }> = (component) => {
    if (component && typeof component.hasUnsavedChanges === 'function' && component.hasUnsavedChanges()) {
      return window.confirm('You have unsaved changes. Leave this page without saving?');
    }
    return true;
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

  /**
   * Where to land after routes are (re)built. A fresh login starts from the
   * root or a `/login` route → go to the dashboard. A refresh / bookmark of an
   * authenticated route → preserve it so deep links survive route restoration.
   */
  private postLoginTarget(): string {
    const path = window.location.pathname;
    const preserve = !!path && path !== '/' && !path.startsWith('/login');
    return preserve ? path + window.location.search : '/dashboard';
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

                // Guard navigation away from any component-backed page that
                // tracks unsaved changes (opt-in via hasUnsavedChanges()).
                for (const r of children) {
                    if ((r as { component?: unknown }).component) {
                        (r as { canDeactivate?: unknown[] }).canDeactivate = [this.canDeactivate];
                    }
                }
                newRoutes.push({ path: menuPath, children });
            }

            newRoutes.push({ path: '**', redirectTo: 'dashboard' });
            if (!this.preLoginRoutes) {
                this.preLoginRoutes = this.router.config;
            }
            this.router.resetConfig(newRoutes);
            this.router.navigateByUrl(this.postLoginTarget());
        },
        error: (err) => {
            console.error('initRoutes failed:', err);
        },
    });
  }
}
