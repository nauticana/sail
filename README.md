# @nauticana/sail

A shared Angular component library for building CRUD-based admin frontends. Provides table management, form handling, navigation, authentication, two-factor authentication, and trusted device management — all driven by metadata from a [keel](https://github.com/nauticana/keel) Go backend.

> **Compatibility:** sail and keel are versioned in lock-step. The current line is **sail v1.1.x ↔ keel v1.2.x**; the agency components in sail v1.1.14 require keel v1.2.41 (sail v1.1.9 needs keel v1.2.16 for the OAuth-connect layer). Earlier lines: **sail v0.5.x ↔ keel v0.5.x**, **sail v0.6.x / v0.7.x ↔ keel v0.7.x**, **sail v0.8.x ↔ keel v0.8.x**, **sail v0.9.x ↔ keel v0.9.x**. Newer sail releases extend the contract — older keel servers reject unknown endpoints with HTTP 404 / 400. The v0.8.x line additionally ships the `table_action` framework (per-table custom buttons surfaced in `TableList` / `TableSearch` / `TableEdit` / `TableDetail`); see the [Migrating to v0.7.0 §5 — TableAction](#migrating-to-v070--payout-user-payment-methods-table-actions) section for the seed shape (basis `table_action` + `authorization_object` + `authorization_object_action` rows) and the [keel/README Table Actions](https://github.com/nauticana/keel#table-actions) section for backend wiring via `handler.WrapTableAction`.

**Recent additions:** `BaseAuthService.acceptToken(jwt)` — adopt an externally-minted JWT (registration / SSO-handoff flows) and run the full post-login sequence (store under the canonical `jwt` key, load appdata, init routes); apps must use this instead of writing `localStorage` directly. `BaseRestService.analytic<T>(endpoint, params?)` — GET a keel `analytic/<endpoint>` report and return its rows. `passwordPolicyValidator` + `BaseAuthService.ensurePasswordPolicy()` — validate passwords against keel's policy (via `SailGuiConfig.passwordPolicyUrl`); see Configuration reference.

> **v1.1.10 is a breaking release.** The base classes migrated to signals (`records()`, `editableRecord()`, `isNew()` …), `login()`/`loginWithGoogle()` now return Observables, CRUD errors are typed `SailApiError`, `BaseView` split into read-only `BaseView` + `AbstractEditableView`, the decorators are renamed `IsSailString`/`IsSailNumeric`, and `configureRestUrls()` is finally safe to call from a subclass constructor. The complete old→new mapping is machine-readable in [`migration_guide.json`](migration_guide.json). Consumers must fully migrate before pushing to test or prod.

## What it provides

| Category | Exports |
|----------|---------|
| **Table components** | `TableList`, `TableSearch`, `TableEdit`, `TableDetail`, `TableLookup`, `TableReport` |
| **Form components** | `DynamicField`, `RecordForm`, `TableForm` |
| **Navigation** | `Navigation` (sidenav + toolbar with menu, responsive) |
| **Login** | `LoginComponent`, `RegisterComponent`, `ChpassComponent`, `ConfirmRegisterComponent`, `ConfirmChpassComponent` |
| **Security** | `TwoFactorSetupComponent`, `TwoFactorVerifyComponent`, `TrustedDevicesComponent`, `AccountDeletionComponent` |
| **Account** | `MyAccountComponent` (self-service hub), `ProfileEditorComponent` (name/locale immediate; email/phone verify-before-apply) |
| **Auth** | `ConsentGateComponent`, `OtpInputComponent`, `SocialLoginComponent` |
| **Billing** | `PlanSelectorComponent`, `PriceSelectorComponent`, `CheckoutButtonComponent`, `PaymentMethodsComponent`, `PortalButtonComponent`, `UsageMeterComponent`, `StatusChipComponent`, `TrialBannerComponent`, `SeatSelectorComponent`, `DunningBannerComponent` |
| **Dashboard** | `DashboardShellComponent`, `DataCardComponent`, `LockedOverlayComponent`, `ActionCenterComponent`, `EntitySelectorComponent`, `VerificationFlowComponent` |
| **Payout** | `PayoutProviderOnboardingComponent`, `PayoutBankInfoFormComponent` |
| **Agency** | `AgencyClientsComponent`, `AgencyStatusBannerComponent`, `AgencyAcceptComponent`, `AgencyEarningsSummaryComponent`, `CommissionLedgerComponent`, `AgencyPayoutHistoryComponent`, `AgencyPayoutProfileComponent` |
| **Payments / SCA** | `UserPaymentMethodsComponent`, `ScaConfirmComponent`, `ScaConfirmer` (port), `SCA_CONFIRMER` (token) |
| **Services** | `BaseAuthService` (OTP / social / push / deleteAccount / logoutEverywhere / profile: `getProfile`, `updateProfile`, `request`+`confirmEmailChange`, `request`+`confirmPhoneChange`), `BillingService`, `AgencyService`, `BackendService`, `PayoutService`, `UserPaymentMethodService`, `loadScript()`, `authInterceptor`, `apiResponseInterceptor` |
| **Abstracts** | `BaseTable`, `BaseForm`, `BaseView`, `AbstractEditableView`, `BaseAsync`, `BaseRestService` |
| **Config** | `SAIL_GUI_CONFIG`, `SailGuiConfig`, `configureRestUrls()` |
| **Models** | `ApplicationData`, `TableDefinition`, `SiudAction`, `ApplicationMenu`, `ConstantValue`, `UserAccount`, `RestReport`, `ReportParam`, `TrustedDevice`, `PublicPlan`, `PlanPrice`, `PaymentMethod`, `Subscription`, `Invoice`, `CheckoutRequest`/`CheckoutResponse`, `PortalResponse`, `UsageMeter`, `ChargeResult`, `UserPaymentMethod`, `TableAction`, `ReusableAccount`, `PayoutOnboardingSession`, `BankInfoFormValue`, `CountryProfile`, `OtpRequest`/`OtpResponse`, `SignupConsent`, `ConsentState`, `ConsentOption`, `SocialProvider`, `PushPlatform`, 2FA types, etc. |
| **Decorators** | `@IsSailString()`, `@IsSailNumeric()` (class-validator based) |
| **Utils** | `titleCase()`, `fromPriceLabel()`, `formatMinorCurrency()` |

## Quick start

### 1. Install

sail is published on the public npm registry — no `.npmrc` or registry override needed:

```bash
npm install @nauticana/sail class-validator
```

This adds the following to your `package.json`:

```json
"dependencies": {
  "@nauticana/sail": "^1.0.0",
  "class-validator": "^0.15.1"
}
```

### 2. Configure tsconfig paths

Since sail ships raw TypeScript source, you need a path mapping so the Angular compiler can resolve and compile it. Add to your `tsconfig.json`:

```json
"paths": {
  "@nauticana/sail": ["./node_modules/@nauticana/sail/src/index"]
}
```

> **Note:** If your tsconfig has `"baseUrl": "src"`, use `"../node_modules/@nauticana/sail/src/index"` instead (paths resolve relative to `baseUrl`).

Suppress class-validator CommonJS warnings in `angular.json`:
```json
"build": {
  "options": {
    "allowedCommonJsDependencies": ["class-validator"]
  }
}
```

### 3. Create your AuthService

```typescript
// src/service/auth.service.ts
import { Injectable } from '@angular/core';
import { BaseAuthService, configureRestUrls } from '@nauticana/sail';
import { environment } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class AuthService extends BaseAuthService {
  constructor() {
    super();
    configureRestUrls(environment.httphost);
  }

  // Add project-specific auth methods here (e.g., loginWithGoogle override, OTP, etc.)
}
```

### 4. Bootstrap your app

```typescript
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { SAIL_GUI_CONFIG, BaseAuthService, authInterceptor, apiResponseInterceptor, TwoFactorVerifyComponent } from '@nauticana/sail';
import { AuthService } from './service/auth.service';
import { DashUser } from './component/dashboard/dash_user';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([apiResponseInterceptor, authInterceptor])),
    provideRouter([]),
    { provide: BaseAuthService, useExisting: AuthService },
    {
      provide: SAIL_GUI_CONFIG,
      useValue: {
        opField: 'op_code',
        hiddenFields: ['op_code', 'PartnerId'],
        appTitle: 'My App',
        appLogoUrl: 'logo.png',
        dashboardComponent: DashUser,
        publicRoutes: [
          { path: 'login/local', loadComponent: () => import('@nauticana/sail').then(m => m.LoginComponent) },
          { path: 'login/register', loadComponent: () => import('@nauticana/sail').then(m => m.RegisterComponent) },
          { path: 'login/chpass', loadComponent: () => import('@nauticana/sail').then(m => m.ChpassComponent) },
          { path: 'login/2fa', component: TwoFactorVerifyComponent },
          { path: 'confirm/register', loadComponent: () => import('@nauticana/sail').then(m => m.ConfirmRegisterComponent) },
          { path: 'confirm/password', loadComponent: () => import('@nauticana/sail').then(m => m.ConfirmChpassComponent) },
        ],
        publicRouteLinks: [
          { label: 'Login', routerLink: '/login/local' },
          { label: 'Register', routerLink: '/login/register' },
        ],
        // Shown in the toolbar before Logout when logged in. Mount the matching
        // authenticated route to MyAccountComponent (its links expect
        // /account/2fa, /account/devices, /account/delete, /login/chpass).
        accountLink: { label: 'My Account', routerLink: '/account' },
        loginFooterLinks: [
          { label: 'Sign in with Google', routerLink: '/login/google' },
        ],
        // Map backend menu items to custom components
        menuItemRouteOverrides: {
          // 'external_connection': SocialConnectionComponent,
          // 'analytic/*': TableReport,
        },
      },
    },
  ],
});
```

> **Auth-loop breaker.** `authInterceptor` carries a built-in circuit breaker: after 5 `401`s on token-bearing keel API calls within 10s it opens for 30s and refuses those requests **locally** (never sent), so a stale/rejected session can't drive the app to hammer the API and the edge/CDN. Only `401` counts — a `403` is a legitimate permission denial, not a session failure. A later success **or accepting a new token** (login) closes it, so a freshly authenticated session is never blocked. No wiring needed beyond registering `authInterceptor`.

> **Phone-number change (opt-in).** `ProfileEditorComponent` and `MyAccountComponent` gate phone change behind a `phoneChangeEnabled` input (default `false`, since it needs an SMS provider — keel returns 503 without `Notify`). Enable it once your backend has SMS wired: `<sail-my-account [phoneChangeEnabled]="true" />` or `<sail-profile-editor [phoneChangeEnabled]="true" />`.

### 5. Create the root component

```typescript
// src/app/app.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Navigation } from '@nauticana/sail';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Navigation],
  template: `<sail-navigation><span toolbar-title>My App</span></sail-navigation>`,
})
export class App {}
```

Place the application logo in the consumer's `public/` directory (for example,
`public/logo.png`) and set the same public URL in `appLogoUrl`. Sail displays it
in the sidenav toolbar as a link to `/`. When `appLogoUrl` is omitted, the link
falls back to `appTitle`, then to a home icon, so home navigation remains
available without requiring a library-owned brand asset. The consuming app may
also reuse that asset as its favicon:

```html
<link rel="icon" type="image/png" href="logo.png">
```

### 6. Provide global styles

All sail components use `ViewEncapsulation.None` — they ship no CSS. Your project must provide a global stylesheet covering sail selectors.

**Required structural styles** (without these, the sidenav collapses and gets cut off). Add to your `src/styles.css`:

```css
.sidenav-container { height: 100vh; }
.sidenav { width: 250px; }
```

Key CSS classes used by components:

```
/* Layout */
.auth-container, .auth-card, .auth-header, .auth-title, .auth-form,
.auth-actions, .auth-footer, .auth-app-title, .auth-checkbox,
.auth-section-label, .auth-instructions, .form-row, .register-card,
.sail-navigation-home, .sail-navigation-logo, .sail-navigation-home-title

/* Feedback */
.auth-error, .auth-success, .geocode-status, .geocode-loading,
.geocode-success, .geocode-error

/* Tables */
.edit-container, .actions-bar, .tab-content, .empty-state,
.detail-actions, .search-actions, .select-btn, .form-container

/* Navigation */
.sidenav-container, .sidenav, .toolbar-spacer

/* State classes */
.deleted-record, .updated-record, .new-record

/* Buttons (replace deprecated Material color attributes) */
.primary, .accent, .warn, .current-device-badge

/* Security */
.twofactor-qr, .twofactor-backup, .backup-code-list,
.trusted-devices-table
```

## How it works

sail follows a **metadata-driven** architecture. On login, the backend returns `ApplicationData` containing:

- **MainMenu** — menu structure with pages and permissions
- **Permissions** — role-based access control entries
- **TableDefinitions** — column metadata, types, validation rules, foreign keys
- **Apis** — REST endpoint mappings per table
- **ConstantCache / TableCache** — dropdown/lookup values

`BaseAuthService.initRoutes()` dynamically builds Angular routes from this metadata. Each menu item automatically gets a `TableSearch` or `TableList` route with the correct API endpoint and table metadata. Custom components can override specific menu items via `menuItemRouteOverrides` in the config.

## List pagination

keel REST list responses are paginated:

```json
{ "items": [...], "limit": 100, "offset": 0, "total": 12345 }
```

`BackendService.list<T>()` continues to return `Observable<T[]>` — sail unwraps `items` for you. To access the metadata, use `listPaginated<T>()`:

```typescript
this.backend.listPaginated<MyRow>('orders', { _limit: '50', _offset: '0' })
    .subscribe((page) => {
      this.rows.set(page.items);
      this.total.set(page.total);   // total rows matching the filter
    });
```

Default page size is 100, capped at 1000 server-side. Pass `_limit` / `_offset` in the filter map to control paging.

## Configuration reference

```typescript
interface SailGuiConfig {
  opField: string;                    // Operation field name (default: 'op_code')
  hiddenFields: string[];             // Fields hidden from forms (default: ['op_code', 'PartnerId'])
  appTitle?: string;                  // Shown on login pages
  appLogoUrl?: string;                // Public logo URL used by the navigation home link
  googleMapsApiKey?: string;          // For RegisterComponent geocoding
  dashboardComponent?: Type<any>;     // Component for /dashboard route
  publicRoutes?: Routes;              // Routes available before login
  publicRouteLinks?: RouteLink[];     // Links shown in toolbar when logged out
  loginFooterLinks?: RouteLink[];     // Extra links below login form
  extraRoutes?: (data) => Routes;     // Dynamic routes from ApplicationData
  menuItemRouteOverrides?: {          // Map RestUri to custom component
    [restUriPattern: string]: Type<unknown>;  // Supports 'exact' and 'prefix/*'
  };

  // Social / consent / account-deletion config
  googleClientId?: string;            // Google Identity Services client ID
  appleServiceId?: string;            // Apple Services ID
  appleRedirectUri?: string;          // Apple Sign-In redirect URI
  privacyPolicyUrl?: string;          // Linked from ConsentGateComponent and the login footer
  termsUrl?: string;                  // Linked from the SMS-consent disclosure and the login footer
  defaultPolicyVersion?: string;      // Content hash of the deployed policy
  defaultPolicyLanguage?: string;     // ISO 639-1 fallback language
  accountDeletedRoute?: string;       // Route after account deletion (default '/login/local')
  passwordPolicyUrl?: string;         // Public route serving keel's password policy (see below)
}
```

### Password-policy validation

Set `passwordPolicyUrl` to the app's public route for keel's `PublicHandler.GetPasswordPolicy`
(e.g. `'/public/v1/auth/password/policy'`). `BaseAuthService.ensurePasswordPolicy()` fetches it
once into the `passwordRules` signal, and `passwordPolicyValidator(() => auth.passwordRules())`
validates new-password inputs against the real policy before submit (`passwordPolicyHint(rules)`
builds the matching hint text). Built into `chpass` / `confirm-chpass`; reuse in app signup forms.
Omit the URL to skip client-side policy checks. The server stays the authoritative gate.

## Backend endpoints (keel v1.0)

| Endpoint | Purpose |
|----------|---------|
| `POST /public/login/local` | Username/password login with 2FA + trusted-device support |
| `POST /public/login/google` | Gmail OAuth-code login (legacy; prefer `/public/login/social`) |
| `POST /public/login/social` | ID-token social login (Google, Apple) |
| `POST /public/otp/send` | Send OTP code to phone or email; returns opaque `otpToken` |
| `POST /public/otp/verify` | Verify OTP code with `otpToken`, returns JWT |
| `POST /public/otp/resend` | Re-issue OTP for an existing `otpToken` |
| `POST /public/2fa/verify` | Login-time TOTP verification (uses `loginToken`) |
| `POST /public/2fa/backup-verify` | Login-time backup-code verification |
| `GET /api/config/appdata` | Metadata (menus, permissions, table definitions) |
| `POST/GET/DELETE /api/{version}/{table}/list\|get\|post\|delete` | CRUD operations (paginated `list`) |
| `POST /api/user/2fa/setup` | Generate TOTP secret, QR URI, and backup codes — **requires re-auth** |
| `POST /api/user/2fa/verify` | Confirm 2FA setup by verifying TOTP code |
| `POST /api/user/2fa/disable` | Disable 2FA — **requires password + current TOTP code** |
| `GET /api/user/trusted-device/list` | List trusted devices |
| `POST /api/user/trusted-device/revoke` | Revoke a trusted device |
| `POST /api/user/logout-everywhere` | Sign out of all devices — **requires re-auth** |
| `DELETE /api/user/account` | Soft-delete the caller's account — **requires re-auth** |
| `POST /api/push/register` | Register an FCM / APNs token |
| `POST /api/push/revoke` | Revoke an FCM / APNs token |
| `POST /api/billing/checkout` | Create provider-hosted checkout session — **JWT-gated, allowlist-validated** |
| `GET /public/plans` | Subscription plan catalog (unauthenticated) |
| `GET /api/billing/subscription` | Active subscription for the partner |
| `POST /api/billing/subscription/cancel` | Cancel auto-renew |
| `GET /api/billing/invoices` | Invoice history |
| `GET /api/billing/payment-methods` | Saved payment methods |

Device registration happens within `/public/2fa/verify` when `trustDevice=true`. Since **keel v0.9 / sail v0.9.0**, the trusted-device credential is a server-minted `keel_td` cookie (HttpOnly + Secure + SameSite=Strict) — not a client-supplied fingerprint. sail sets `withCredentials: true` on the login and 2FA-verify calls so the cookie round-trips; see [Enabling 2FA → Cross-origin cookie requirement](#cross-origin-cookie-requirement) below.

## Enabling 2FA in your project

Add the 2FA verification route to your `publicRoutes` config:
```typescript
import { TwoFactorVerifyComponent, TwoFactorSetupComponent, TrustedDevicesComponent } from '@nauticana/sail';

// In publicRoutes:
{ path: 'login/2fa', component: TwoFactorVerifyComponent }

// In extraRoutes or authenticated routes (optional — for user self-service):
{ path: 'security/2fa', component: TwoFactorSetupComponent }
{ path: 'security/devices', component: TrustedDevicesComponent }
```

The login flow handles 2FA automatically: when the backend returns `twoFactorRequired: true`, sail redirects to `/login/2fa`. No other code changes needed.

### Cross-origin cookie requirement

The "trust this device" feature (keel v0.9+) is backed by a server-set HttpOnly cookie named `keel_td`. The lifecycle is entirely server-driven:

1. On `POST /public/2fa/verify` with `trustDevice: true`, keel mints a 32-byte secret, stores its SHA-256, and returns the raw secret to the browser **only** as a `Set-Cookie: keel_td=…` header (never in the JSON body).
2. On the next `POST /public/login/local` (or `/public/login/gmail`), the browser sends the `keel_td` cookie back, keel hashes it, finds the matching row, and **skips the 2FA prompt**.

For the browser to store and resend that cookie, the requests must be credentialed. sail already sets `withCredentials: true` on `login()`, `loginWithGoogle()`, `verify2FALogin()`, and `verifyBackupCode()` — **you do not add this in your app code**. But the keel backend must permit credentialed CORS, or the browser drops the cookie and every login re-prompts for 2FA:

- **Same-origin** deployments (SPA served from the same host as the API) work with no extra config — credentialed same-origin requests are always allowed.
- **Cross-origin** deployments (SPA on a different host/port than the API) require the keel `HttpBackend` to set:
  - `AllowCredentials: true` → emits `Access-Control-Allow-Credentials: true`
  - `Origin` = the **exact** SPA origin (e.g. `https://app.example.com`). A wildcard `*` is rejected by the browser for credentialed responses — keel's CORS layer enforces this.

If "trust this device" appears to do nothing (user is 2FA-prompted on every login despite checking the box), the cause is almost always a missing `AllowCredentials` / wildcard-origin on the backend — open devtools and confirm the `keel_td` cookie is actually set after a successful verify.

### Session token storage

The session JWT and the short-lived `loginToken` are kept in `localStorage` (the trusted-device secret is the only HttpOnly cookie). This is a deliberate trade-off for a token-based SPA, but it means any XSS in the consuming app can read the session token. Harden accordingly: ship a strict `Content-Security-Policy`, keep third-party script surface minimal, and prefer short JWT lifetimes on the keel side.

## Billing

sail ships a shared `BillingService` and ten billing components backed by keel's payment endpoints (see [keel/SHARED_PAYMENT.md](https://github.com/nauticana/keel/blob/main/SHARED_PAYMENT.md) for the provider contract — Stripe by default, pluggable).

### Service

```typescript
import { BillingService } from '@nauticana/sail';

@Component({ /* ... */ })
export class PricingPage {
  private billing = inject(BillingService);

  readonly plans = toSignal(this.billing.listPlans(), { initialValue: [] });
  readonly sub   = toSignal(this.billing.getSubscription());
}
```

| Method | Endpoint | Returns |
|--------|----------|---------|
| `listPlans()` | `GET /public/plans` | `Observable<PublicPlan[]>` |
| `createCheckout(req)` | `POST /api/billing/checkout` | `Observable<CheckoutResponse>` |
| `getSubscription()` | `GET /api/billing/subscription` | `Observable<Subscription>` |
| `cancelSubscription()` | `POST /api/billing/subscription/cancel` | `Observable<void>` |
| `changePlan(planId)` | `POST /api/billing/subscription/change` | `Observable<void>` |
| `setSeats(seats)` | `POST /api/billing/subscription/seats` | `Observable<void>` |
| `listInvoices()` | `GET /api/billing/invoices` | `Observable<Invoice[]>` |
| `listPaymentMethods()` | `GET /api/billing/payment-methods` | `Observable<PaymentMethod[]>` |
| `createPortalSession()` | `POST /api/billing/portal` | `Observable<PortalResponse>` |
| `listUsage()` | `GET /api/billing/usage` | `Observable<UsageMeter[]>` |

### Components

**Plan picker** — pure presentational, no API calls:
```html
<sail-plan-selector
    [plans]="plans()"
    [selected]="selectedPlan()"
    [features]="{ PRO: ['Unlimited users', '24/7 support'] }"
    (selectionChange)="selectedPlan.set($event)">
</sail-plan-selector>
```

**Offer / price picker (v1.0.5)** — a plan no longer has a single price. keel v1.0.5 sells per-plan **offers** in the `subscription_plan_price` table (billing cycle × commitment term, each with its own `provider_price_id`), surfaced as `PublicPlan.prices: PlanPrice[]`. The customer picks an offer **at checkout**; its `priceId` is what flows to `<sail-checkout-button>`:

```html
<sail-price-selector
    [prices]="selectedPlan().prices ?? []"
    [selected]="offer()?.priceId"
    (selectionChange)="offer.set($event)">
</sail-price-selector>
```

`<sail-price-selector>` is presentational (a `radiogroup` of offers), formats each amount with `Intl` from the offer's currency (so JPY/BHD render with the right number of decimals), and maps PERIOD_TYPE codes to copy via `[cycleLabels]`. It emits the full `PlanPrice` so you keep the chosen terms, not just the id.

> **Migration.** The flat `PublicPlan.priceId` is deprecated (keel v1.0.5 dropped `subscription_plan.provider_price_id`) — read the id from the selected offer (`offer().priceId`). **keel v1.0.7 also removed `PublicPlan.monthlyCost`/`annualCost`** from both `/public/plans` and the billing catalog, so any plan-card code reading them now gets `undefined`. Derive a display price from the offers with `fromPriceLabel(plan.prices)` (used by `<sail-plan-selector>`), or render the per-offer amounts via `<sail-price-selector>`. These fields are removed from sail's `PublicPlan` type so the compiler flags any remaining references.

**Checkout button** — calls `createCheckout()` and redirects to the provider-hosted URL. Feed it the chosen offer's `priceId`:
```html
<sail-checkout-button
    [priceId]="offer()!.priceId!"
    [mode]="'subscription'"
    [successUrl]="'https://app.example.com/billing/done'"
    [cancelUrl]="'https://app.example.com/billing'"
    [email]="userEmail">
</sail-checkout-button>
```

For one-off charges use `[mode]="'payment'"`. For "save a card without charging" (Stripe SetupIntent), use `[mode]="'setup'"` and **omit** `[priceId]` — keel rejects a non-empty `priceId` in setup mode with 400.

> **keel allowlists** — `priceId`, `successUrl`, and `cancelUrl` must each match the server-side `AllowedPriceIDs` / `AllowedRedirectHosts` allowlists; otherwise the request is rejected with 400. Configure these on your keel deployment.

> **`AllowedRedirectHosts` matching** is hostname-only by default — entries without a colon (e.g. `app.example.com`) tolerate any port. Add an explicit port (e.g. `app.example.com:8443`) only when port-strict matching is intentional.

**Metadata stringification.** `CheckoutRequest.metadata` keys and values are typed as strings because that's what providers store. keel stringifies numeric and boolean metadata server-side, so a `partner_id: 42` written in your domain handler arrives back in webhook payloads as `"42"`. Stringify on the way in:

```typescript
metadata: {
  partner_id: String(partnerId),
  source:     'pricing-page',
}
```

**Payment methods** — lists saved methods with loading and empty states:
```html
<sail-payment-methods></sail-payment-methods>
```

### Registration → checkout flow

The registration confirmation (`ConfirmRegisterComponent`) already handles the payment redirect. When the backend returns `paymentRequired: true`, the user is sent to `resp.paymentUrl` (Stripe Checkout) automatically. No extra wiring needed — just select a paid plan during registration.

### `BaseAsync`

Both `CheckoutButtonComponent` and `PaymentMethodsComponent` extend `BaseAsync` — an abstract class that bundles `loading()`, `errorMessage()`, `successMessage()` signals and a `run(obs, onSuccess, fallbackError)` helper. Reuse it in your own async components:

```typescript
import { BaseAsync, BillingService } from '@nauticana/sail';

@Component({ /* ... */ })
export class MyWidget extends BaseAsync {
  private billing = inject(BillingService);

  cancel() {
    this.run(
      this.billing.cancelSubscription(),
      () => this.successMessage.set('Cancelled.'),
      'Could not cancel.',
    );
  }
}
```

Template:
```html
<button (click)="cancel()" [disabled]="loading()">Cancel plan</button>
@if (errorMessage()) { <div class="auth-error">{{ errorMessage() }}</div> }
@if (successMessage()) { <div class="auth-success">{{ successMessage() }}</div> }
```

### Suggested styles for billing components

Add to `src/styles.css` to match the rest of the library:
```css
/* Plan selector */
.plan-selector { display: flex; gap: 1rem; flex-wrap: wrap; }
.plan-card { flex: 1 1 220px; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
.plan-selected { border-color: #1976d2; box-shadow: 0 0 0 2px #1976d2; }
.plan-caption { margin: 0 0 .5rem; }
.plan-price .plan-amount { font-size: 1.5rem; font-weight: 600; }
.plan-features { padding-left: 1.2rem; }

/* Payment methods */
.payment-methods-list { list-style: none; padding: 0; }
.payment-method { display: flex; justify-content: space-between; padding: .5rem 0; }
.payment-default-badge { font-size: .75rem; background: #e0e0e0; padding: 2px 8px; border-radius: 12px; }

/* Checkout button */
.checkout-button { display: flex; flex-direction: column; gap: .5rem; }
```

### Customer portal (v1.0.0)

`createPortalSession()` + `<sail-portal-button>` mirror checkout — POST `/api/billing/portal`, then redirect to the provider-hosted customer portal where the partner manages their payment method / subscription:

```html
<sail-portal-button [label]="'Manage billing'"></sail-portal-button>
```

### Usage meters (v1.0.0)

`listUsage()` returns `UsageMeter[]` (`{ resource, used, limit }`, matching keel's `UsageItem`); `<sail-usage-meter>` renders one progress bar per resource (a `limit < 0` shows "Unlimited"):

```typescript
readonly meters = toSignal(this.billing.listUsage(), { initialValue: [] });
```
```html
<sail-usage-meter [meters]="meters()"></sail-usage-meter>
```

### Redirect-action (v1.0.0)

A `TableAction` with `kind: 'R'` (redirect — the `constant_value` code) makes `BaseTable.executeAction` POST and then follow the returned `{ url }` instead of refreshing — so checkout / portal / any provider-hosted handoff can be declared as a basis `table_action` row with **no bespoke component**. The backend action handler returns `{ "url": "https://…" }`.

> **Response-shape contract.** The generic redirect-action path reads a bare `url` because it's polymorphic — one dispatch for checkout / portal / export / etc., where the action's identity lives in the metadata, not the payload. keel's `WrapTableAction` enforces no shape; your inner handler must return `{ url }`. The *typed* billing endpoints keep specific names instead (`createCheckout()` → `checkoutUrl`, `createPortalSession()` → `portalUrl`). So the same portal concept has two response shapes depending on the path: wire it as `<sail-portal-button>` (typed → `portalUrl`) **or** as a `table_action` redirect (generic → `url`), not both.

### Status chip (v1.0.1)

`<sail-status-chip>` resolves a code to its caption from the client-cache `constant_value` dictionary — no per-app `@switch`. It defaults to the `SUBSCRIPTION_STATUS` domain (so `T` trialing / `X` past-due render with no app code) and works for any constant domain via `[domain]`. The code is exposed as `[attr.data-status]` so the app can colour the chip:

```html
<sail-status-chip [value]="sub()?.status"></sail-status-chip>
<sail-status-chip [value]="invoice.status" domain="INVOICE_STATUS"></sail-status-chip>
```

> Replaces a downstream app's hardcoded status `@switch` (e.g. seo's): captions are backend-authoritative — when a dictionary row is absent the raw code shows, never a fabricated label.

### Trial banner (v1.0.1)

`<sail-trial-banner>` shows "Trial ends in N days" from `Subscription.trialEnd`; it renders nothing when the value is empty, unparseable, or already past, so it can sit unconditionally in the template:

```html
<sail-trial-banner [trialEnd]="sub()?.trialEnd"></sail-trial-banner>
```

### Seat selector (v1.0.1)

`<sail-seat-selector>` is a presentational quantity stepper seeded from `Subscription.seats`. Feed the result into checkout (`[quantity]` / metadata) for new subs, or `BillingService.setSeats()` for an existing one:

```html
<sail-seat-selector [seats]="sub()?.seats ?? 1" [min]="1" (seatsChange)="seats.set($event)"></sail-seat-selector>
```

### Plan change vs first-time checkout (v1.0.1)

First-time checkout uses `<sail-checkout-button>` (provider-hosted). For an **existing** subscription, upgrade/downgrade is a distinct path — `BillingService.changePlan(planId)` routes to keel's `SubscriptionLifecycle.ChangePlan` via an endpoint the app exposes. Wire the picker's selection to whichever path applies:

```typescript
onPlanPicked(planId: string) {
  this.sub() ? this.billing.changePlan(planId).subscribe() : this.startCheckout(planId);
}
```

`<sail-plan-selector>` varies its CTA copy by `PublicPlan.activationMode` ("Start trial" for `T`, "Subscribe" for `P`, "Activate" for `F`); override or extend via `[ctaLabels]="{ S: 'Add seats' }"`.

### Dunning banner (v1.0.1)

`<sail-dunning-banner>` shows only when `Subscription.status === 'X'` (past-due / keel `SetDunningState`), prompting the partner to update their card and deep-linking to the provider portal via an embedded `<sail-portal-button>`:

```html
<sail-dunning-banner [status]="sub()?.status"></sail-dunning-banner>
```

### Compose a full Billing screen

A complete screen is the pieces above assembled over `BillingService` — no metadata CRUD (billing data is partner-scoped, read-mostly, money-formatted, with an external-redirect action, which `TableList`/`TableEdit` don't model):

```html
<sail-dunning-banner [status]="sub()?.status"></sail-dunning-banner>
<sail-trial-banner [trialEnd]="sub()?.trialEnd"></sail-trial-banner>
<sail-status-chip [value]="sub()?.status"></sail-status-chip>
<sail-plan-selector [plans]="plans()" [selected]="sub()?.planId" (selectionChange)="onPlanPicked($event)"></sail-plan-selector>
<sail-price-selector [prices]="selectedPlan()?.prices ?? []" [selected]="offer()?.priceId" (selectionChange)="offer.set($event)"></sail-price-selector>
<sail-seat-selector [seats]="sub()?.seats ?? 1" (seatsChange)="seats.set($event)"></sail-seat-selector>
<sail-checkout-button [priceId]="offer()!.priceId!" [quantity]="seats()" [successUrl]="okUrl" [cancelUrl]="backUrl"></sail-checkout-button>
<sail-usage-meter [meters]="usage()"></sail-usage-meter>
<sail-payment-methods></sail-payment-methods>
<sail-portal-button></sail-portal-button>
<!-- invoices: render listInvoices() rows directly -->
```

## Agency / reseller UI (v1.1.14)

sail v1.1.14 supplies composable, unstyled agency components over keel v1.2.41.
The app owns routes, route guards, brand copy, global CSS, and any columns that
refer to an app-specific managed entity.

`AgencyService` covers profile enrollment, invitation staging/acceptance,
delegation/revocation, per-client referral/wholesale selection, earnings, and
payout-profile selection. Its DTOs use the upstream names
`agency_client_invitation`, `agency_client_delegation`, and
`agency_client_rate`; there is no client-side rule-schedule model.
The enrollment method is `enroll()`; downstream `enrollReferral()` calls must
be renamed when adopting this release.

Compose an agency page from the pieces you need:

```html
<sail-agency-clients
  [extraColumns]="clientColumns"
  [showBillingModelControls]="true" />
<sail-agency-earnings-summary [earnings]="earnings()" [activeClients]="activeClients()" />
<sail-commission-ledger [entries]="earnings()?.entries ?? []" />
<sail-agency-payout-history [payouts]="earnings()?.payouts ?? []" />
<sail-agency-payout-profile />
```

`AgencyClientsComponent` renders status values through the shared
`StatusChipComponent` and backend constant catalogues. It accepts app-specific
columns rather than assuming the managed entity. Accepted clients begin in
referral mode; wholesale controls appear only when the profile permits them and
the app opts in with `showBillingModelControls`.

Load keel's v1.2.40 basis seed so status chips receive these canonical domains:

| Domain | Values |
|---|---|
| `agency_client_status` | `S` Staged, `I` Invited, `V` Client, `X` Cancelled |
| `agency_billing_model` | `R` Referral, `W` Wholesale |
| `agency_commission_status` | `H` Held, `P` Payable, `R` Reserved, `D` Paid, `O` Offset |
| `agency_payout_status` | `C` Created, `P` Processing, `D` Paid, `F` Failed, `R` Returned, `V` Reversed, `M` Manual review |

Do not substitute app-local domain names such as `billing_model` or
`commission_status`; a missing canonical domain deliberately renders the raw
code so configuration drift remains visible.

`AgencyAcceptComponent` keeps consent explicit and persists an invitation token
when the authenticated user still needs to create a business partner. Consumers
handle its navigation outputs and route back after business setup. Other 409
conflicts, such as an existing delegation or self-delegation, remain on the
invitation screen as errors instead of entering the business-setup flow. The
branch uses keel's stable RFC 7807 `code: "agency_no_partner"` (keel v1.2.41),
not error prose.

The payout-profile component composes the existing provider-onboarding surface
and only allows a fully onboarded destination returned by keel. Mount it only
for an approved, non-suspended agency; keel intentionally rejects its GET for a
pending profile. The ledger and payout-history components show default empty
messages; pass `[emptyMessage]="''"` when a composed page should omit empty
regions entirely.

All accounting values are integer minor units. `formatMinorCurrency()` uses the
currency exponent reported by `Intl.NumberFormat`, so zero- and three-decimal
currencies render correctly; earnings stay separated by currency rather than
being summed into a misleading total.

The agency URL defaults use `/api/v1/agency/*`. Apps mounting Keel elsewhere
must override the `RestURL.agency*URL` values with `configureRestUrls()`.

## Off-session SCA / 3DS confirmation (v1.0.x)

When an app charges a rider's **vaulted** card off-session (keel `payment.ChargeClient` / `StripeChargeClient`), the provider may return `requires_action` — the cardholder must complete a Strong Customer Authentication (3DS) challenge. keel surfaces the hooks on `ChargeResult` (`ClientSecret`, `ActionURL`); sail standardizes the **client-side** confirmation so it isn't rebuilt per app.

sail stays provider-agnostic: it ships **no payment-provider SDK** and **no default confirmer**. It provides a port (`ScaConfirmer`), the `SCA_CONFIRMER` injection token, and `<sail-sca-confirm>`, which:

- redirects to `ChargeResult.actionUrl` when present (provider-hosted challenge — no SDK needed); else
- delegates the inline `ChargeResult.clientSecret` to the app-registered `SCA_CONFIRMER`.

### Backend contract (app-owned)

Off-session charging is a worker/handler concern, so the **app** owns the charge endpoint. Have it call keel's `ChargeClient.Charge` and return the normalized result as camelCase JSON matching sail's `ChargeResult`:

```jsonc
// POST /api/<app>/charge  →  200
{ "status": "requires_action", "clientSecret": "pi_..._secret_...", "actionUrl": "" }
// or { "status": "succeeded", "providerChargeId": "pi_..." }
// or { "status": "failed", "error": "card_declined" }
```

> `ChargeRequest.Metadata` (keel v1.0.4) carries `ride_id` / `user_id` / `tip_amount` through to the settled charge's `PaymentEvent.Metadata`, so the webhook can correlate and split the fare — set it on the backend, not the client.

### Frontend adoption (downstream projects)

**1. Implement the provider confirmer** (Stripe shown; lives in the app, behind an *optional* `@stripe/stripe-js` peer dep — non-Stripe apps skip it):

```typescript
import { Injectable } from '@angular/core';
import { loadStripe } from '@stripe/stripe-js';
import { ScaConfirmer, ScaResult } from '@nauticana/sail';

@Injectable({ providedIn: 'root' })
export class StripeScaConfirmer implements ScaConfirmer {
  async confirm(clientSecret: string): Promise<ScaResult> {
    const stripe = await loadStripe(/* publishable key from backend cache */);
    if (!stripe) return { outcome: 'failed', error: 'Stripe.js failed to load' };
    const { error } = await stripe.handleNextAction({ clientSecret });
    return error ? { outcome: 'failed', error: error.message } : { outcome: 'succeeded' };
  }
}
```

**2. Register it at composition time** (`app.config.ts` / `main.ts`):

```typescript
import { SCA_CONFIRMER } from '@nauticana/sail';

providers: [
  { provide: SCA_CONFIRMER, useExisting: StripeScaConfirmer },
]
```

**3. Drop the component into the post-charge flow** — bind the charge response and react to the outcome:

```html
<sail-sca-confirm
    [result]="charge()"
    (confirmed)="onPaid()"
    (failed)="onScaFailed($event)">
</sail-sca-confirm>
```

`<sail-sca-confirm>` renders nothing for `succeeded`, the decline message for `failed`, and a confirm button for `requires_action`. The publishable key is backend-authoritative — read it from the auth/app-data cache, never hardcode a fallback.

## Consent capture

`ConsentGateComponent` is a reusable signup-consent primitive that mirrors keel's `user.SignupConsent` structure. It always renders two required checkboxes (`privacy_policy`, `cross_border`) and lets you declare any number of optional consents.

```typescript
import { ConsentGateComponent, ConsentOption, ConsentState, ConsentType } from '@nauticana/sail';

@Component({
  imports: [ConsentGateComponent],
  template: `
    <sail-consent-gate
        [policyVersion]="'v1'"
        [policyLanguage]="'en'"
        [optionalConsents]="extras"
        (consentStateChange)="onConsent($event)">
    </sail-consent-gate>
  `,
})
export class SignupPage {
  readonly extras: ConsentOption[] = [
    { id: ConsentType.VIDEO_OPT_IN, label: 'Record my trips on video', hint: 'Optional; change in settings later.' },
    { id: ConsentType.MARKETING,    label: 'Email me product updates' },
  ];

  onConsent(state: ConsentState) {
    // state.consents is Record<string, boolean>, state.valid is false until
    // both required checkboxes are ticked.
  }
}
```

The component relies on `config.privacyPolicyUrl`, `config.defaultPolicyVersion`, and `config.defaultPolicyLanguage` as fallbacks when the inputs are omitted.

## Phone / email OTP login

keel issues an opaque server-side `otpToken` from `sendOtp()` (32 random bytes, base64-URL, bound to the user_id in cache for ~5 min). Echo it back verbatim to `verifyOtp()` / `resendOtp()`. The login fall-through still returns 200 with a token on unknown contacts (no SMS dispatched), so the response shape never leaks which numbers are registered.

`BaseAuthService` provides `sendOtp()`, `resendOtp()`, and `verifyOtp()`. Pair them with the presentational `OtpInputComponent` for a complete OTP screen:

```typescript
// src/page/otp_confirm.ts
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BaseAuthService, OtpInputComponent } from '@nauticana/sail';

@Component({
  imports: [OtpInputComponent],
  template: `
    <sail-otp-input
        [contact]="contact()"
        [length]="6"
        (codeComplete)="onVerify($event)"
        (resend)="onResend()">
    </sail-otp-input>
    @if (error()) { <div class="auth-error">{{ error() }}</div> }
  `,
})
export class OtpConfirmPage {
  private auth = inject(BaseAuthService);
  private router = inject(Router);
  readonly contact = signal('+1 (416) 555-1234');
  readonly otpToken = signal('');
  readonly error = signal('');

  onVerify(code: string) {
    this.auth.verifyOtp({ otpToken: this.otpToken(), code }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => this.error.set(err.error?.message ?? 'Invalid code.'),
    });
  }

  onResend() {
    this.auth.resendOtp(this.otpToken()).subscribe();
  }
}
```

Override `verifyOtp()` in your own `AuthService extends BaseAuthService` when you need role routing.

| Endpoint | Service method |
|----------|---------------|
| `POST /public/otp/send` | `sendOtp(req)` — returns `{ otpToken }` |
| `POST /public/otp/resend` | `resendOtp(otpToken, purpose?)` |
| `POST /public/otp/verify` | `verifyOtp({ otpToken, code })` — auto-completes login on success |

## Social login

`SocialLoginComponent` renders Google / Apple buttons using each provider's official SDK. It loads the SDKs dynamically via `loadScript()` — nothing is bundled into your app.

```html
<sail-social-login
    [providers]="['google', 'apple']"
    [consent]="consentState"
    (loginSuccess)="onSuccess($event)"
    (loginError)="onError($event)">
</sail-social-login>
```

Config required in `SAIL_GUI_CONFIG`:

```typescript
{
  googleClientId: 'xxxxx.apps.googleusercontent.com',
  appleServiceId: 'com.example.app.web',
  appleRedirectUri: 'https://example.com/login',  // must match Apple Services ID
}
```

Under the hood, the component calls `BaseAuthService.loginSocial(provider, idToken, consent)` → `POST /public/login/social` and emits `loginSuccess: LoginResponseSocial`. The session is completed automatically (token stored, app data loaded, routes initialized).

For backward compatibility, the older OAuth-code flow `BaseAuthService.loginWithGoogle(code)` (hits `/public/login/google`) is still supported; prefer `loginSocial` for new code.

## Dashboard components

Horizontal building blocks for an entitlement-aware dashboard. All are presentational (signals in, events out) and ship no CSS — the app styles the documented class hooks and supplies the metric data, chart, and action logic.

- **`DashboardShellComponent`** (`sail-dashboard-shell`) — responsive card-grid layout. `[heading]` + a `[dashboardActions]` projection slot for the header; project cards into the default slot. Styles: `.dashboard-shell` / `.dashboard-header` / `.dashboard-grid`.
- **`DataCardComponent`** (`sail-data-card`) — card chrome for one visualization with `[state]` ∈ `loading | ready | empty | error | locked`. The chart is supplied as an `<ng-template>` and instantiated **only** in `ready`, so during loading/error/locked it never exists (no hidden canvas). `description` (required) is the screen-reader text alternative; `[tableHeaders]`/`[tableRows]` render a visually-hidden (`.sr-only`) data table. Emits `upgrade` / `retry`.
- **`LockedOverlayComponent`** (`sail-locked-overlay`) — entitlement gate. Wraps protected content given as an `<ng-template>`; when `[locked]` the template is never instantiated, so **no data exists behind the gate** (DOM, canvas, or network) — the strict free-tier rule. Emits `upgrade`.
- **`ActionCenterComponent`** (`sail-action-center`) — prioritized next-best-action list from `[actions]: ActionItem[]` (sorted by `priority`, done items show a check). Emits `act`.
- **`EntitySelectorComponent`** (`sail-entity-selector`) — scope dropdown over `[entities]: EntityOption[]`; resolves `[selected]` or the first active entity and emits `selectionChange`.
- **`VerificationFlowComponent`** (`sail-verification-flow`) — self-service request → enter-code → verified UI (a 2FA sibling), backend-agnostic: emits `requestVerification` / `confirmCode`, driven by `[step]` + `[errorMessage]` the host feeds back.

```html
<sail-data-card heading="Trends" [state]="state()" description="Weekly visibility trend" (upgrade)="goUpgrade()">
  <ng-template><canvas baseChart [data]="chartData()" [type]="'line'"></canvas></ng-template>
</sail-data-card>
```

Models: `DataCardState`, `ActionItem`, `EntityOption`, `VerificationStep`.

## Provider connections (v1.1.9)

`ConnectionPanel` is the drop-in UI for keel's `oauth/connect` layer — connect a
partner to external providers (Google, GBP, Meta, Shopify, or any API-key service),
then test / disconnect. Presentational and CSS-free; the app owns the provider
catalog and any routing via the outputs.

- **`OAuthConnectionPanelComponent`** (`sail-oauth-connection-panel`) — renders a card per
  `[providers]: OAuthProviderDescriptor[]` with connect / test / reconnect / disconnect.
  Providers with `fields` or a `connectNote` open an inline form/consent step first (API-key
  credentials, a Shopify `shop`, or a "you'll be redirected to…" note); a bare field-less OAuth
  provider redirects straight to consent. `[entityId]` scopes per-business connections and
  reloads on change (0 = tenant-wide). Emits `connected` / `disconnected`.
  Ships no CSS — style `.connections`, `.connection-card`, `.connection-card__{head,title,status,actions}`,
  `.connection-form`, `.connection-panel__error`, and `.status--{connected,error,pending}`.
- Each `OAuthProviderField` has a **`role`**: `credential` (sealed secret), `endpoint` (stored
  as `api_endpoint`), or `param` (OAuth authorize query param) — so field order is
  irrelevant. `icon` is a Material name or an image URL.
- **`OAuthConnectionService`** — `startOAuth(provider, extra)` → consent URL,
  `testConnection`, `list(entityId)` / `disconnect` (generic `partner_credential` REST), and
  `saveApiKey` (POSTs the sealed `/api/oauth/apikey`).

```html
<sail-oauth-connection-panel [providers]="providers" [entityId]="businessId()"
  (connected)="reload()" (disconnected)="reload()"></sail-oauth-connection-panel>
```

The app supplies the descriptor list (which providers, icons, copy, api-key fields);
keel owns the flow and sealed storage. Models: `OAuthProviderDescriptor`,
`PartnerCredential`, `OAuthConnectionView`, `OAuthConnectionStatus`.

## Adding a new domain table

When your project owns a table that isn't part of basis (e.g. `favorite_location`, `support_ticket`, `vehicle`), follow the pattern below so the row plays nicely with keel's generic CRUD endpoints and the sail `<table-edit>` / `<table-list>` components.

### 1. Backend: register the route

Add a `rest_api_header` seed row so keel mounts the CRUD endpoints at boot:

```sql
INSERT INTO rest_api_header (id, master_table)
VALUES ('favorite_location', 'favorite_location');
```

This exposes `GET/POST /api/v1/favorite_location/list,get,post,delete`. The binary reads `rest_api_header` once at startup, so restart `httpsrv` after seeding.

### 2. Frontend: model class extends `SiudAction`

Every row submitted through keel's bulk-POST endpoint is dispatched by an `op_code` field — `I` insert, `U` update, `D` delete, `R` recurse-children, `S` select-only (no-op). Rows without `op_code` are **silently skipped**: the handler still returns 201, but no SQL runs. The way to stay safe is to extend `SiudAction` (which carries `op_code: OpCodeValue` defaulted to `'S'`) rather than declaring a plain interface.

```ts
import { SiudAction } from '@nauticana/sail';

export class FavoriteLocation extends SiudAction {
  Id?: number;
  UserId?: number;
  Label?: string;
  Address?: string;
  Lat?: number;
  Lng?: number;
  SortOrder?: number;
}
```

Field names are **PascalCase** — keel marshals SQL columns to `column.pascal_name` (i.e. `user_id` → `UserId`) for the wire format, and the `<table-edit>` component generator follows the same convention. Snake_case fields will round-trip in some paths but break others (e.g. `<table-edit>` form binding); pick PascalCase up front.

### 3. Frontend: flip op_code before save

When the row leaves the UI, set `op_code` to the operation you actually want:

```ts
import { OpCode } from '@nauticana/sail';
import { BackendService } from 'service/rest_service';
import { FavoriteLocation } from 'model/tripdb';

const backend = inject(BackendService);

const row = new FavoriteLocation();
row.op_code = existing?.Id ? OpCode.Update : OpCode.Insert;
row.Id = existing?.Id;
row.Label = 'Home';
row.Address = '...';

backend.post<FavoriteLocation>('v1/favorite_location', [row]).subscribe();
```

The `<table-edit>` and `<table-list>` components handle this automatically — they tag fetched rows `'S'`, flip to `'U'` on dirty-edit, `'I'` for new rows, and `'D'` when the user deletes. You only need to set `op_code` manually when bypassing those components (custom save flows, bulk imports, etc.).

### 4. Backend permissions

Grant `TABLE SELECT/INSERT/UPDATE/DELETE` to the relevant roles in `authorization_role_permission`. For owner-scoped tables (rows have a `user_id` FK to `user_account`), keel auto-detects `UserSpecific` from the FK + column-name combination and pins the session's user id on insert + filters list/get to the owner automatically — no extra wiring needed.

```sql
INSERT INTO authorization_role_permission (role_id, authorization_object_id, action, low_limit) VALUES
  ('RIDER', 'TABLE', 'INSERT', 'favorite_location'),
  ('RIDER', 'TABLE', 'UPDATE', 'favorite_location'),
  ('RIDER', 'TABLE', 'DELETE', 'favorite_location');
-- SELECT is granted via the wildcard ('RIDER', 'TABLE', 'SELECT', '*') if you have one.
```

### Footguns

- **Plain interfaces instead of `extends SiudAction`** — `op_code` field never exists, every row in a bulk POST is silently skipped, handler returns 201, table stays empty. Symptom: "saving says success but the list comes back empty."
- **Snake_case fields** — keel marshals PascalCase, so a snake_case `address` field on the wire serializes as `Address` from keel but your client TS expects `address`. Mixed payloads break in subtle ways (read paths show data, write paths look like no-ops).
- **Forgetting to restart httpsrv after seeding `rest_api_header`** — the route table is built once at startup. New rows = 404 until restart.

## Tuning edit-form fields (column_display_attribute)

The generic edit form renders each column from keel's metadata. By default:

- **Textarea vs input** follows the column's `InputType` — keel sets
  `textarea` for `TEXT`, `text` for `VARCHAR`. (Earlier builds keyed off
  `Size > 80`, which turned long `VARCHAR`s into textareas; it now trusts
  `InputType`.)
- **Read-only** applies only to primary keys (and FK columns in child rows).

To override per column without changing the schema, seed keel's
`column_display_attribute` table (`table_name, column_name, display_mode,
display_width, display_rows`). sail honours three optional `TableColumn`
fields it produces:

| Field          | Effect |
|----------------|--------|
| `DisplayMode`  | `R` read-only (shown display-only; **hidden when empty**, so a new record's audit fields disappear and on edit only populated ones show). `H` hidden everywhere — the new-record builder omits it so the DB default/sequence/trigger fills it. `D` editable, prefilled with the column default on a new record. `I` insert-only — editable while creating, locked once it exists. `U` update-stamp — display-only like `R` in the UI, but keel auto-sets it on every UPDATE (`now()` for timestamps, `user_id` for integers), so `updated_at`/`updated_by` need no DB trigger. Empty/NULL = editable. |
| `display_rows` | Textarea height. `1` forces a single-line input — keep a column `TEXT` (so bulk-loaded values don't overflow) yet render it on one line. |
| `display_width`| Field max-width in px. |

`R`/`H`/`I` are also enforced server-side by keel (excluded from generic
INSERT/UPDATE), so the modes are real, not just cosmetic. No rows seeded =
unchanged behaviour. Requires keel with the `column_display_attribute`
feature; rebuild httpsrv after seeding (metadata is read once at startup).

## Account deletion / logout everywhere / push tokens

These are App Store / Play Store compliance primitives from keel. All are opt-in.

### Re-authentication gate

The four sensitive endpoints below require **recent re-authentication** before they will run — pass `password` and/or `twoFactorCode` to prove the user is still present at the keyboard. The shipped components already capture this; only callers using the service methods directly need to do this.

| Method | Required re-auth |
|--------|-----------------|
| `setup2FA(reauth)` | `password` (or `twoFactorCode` when re-rotating) |
| `disable2FA(password, code)` | **both** `password` and current TOTP `code` |
| `deleteAccount(reauth, reason?)` | `password` (or `twoFactorCode`) |
| `logoutEverywhere(reauth)` | `password` (or `twoFactorCode`) |

The `ReauthCredentials` type is exported as a shared shape:
```typescript
import { ReauthCredentials } from '@nauticana/sail';
const reauth: ReauthCredentials = { password: 'hunter2' };
auth.deleteAccount(reauth, 'Closing my account.').subscribe();
```

### Account deletion

```html
<sail-account-deletion [confirmationText]="'DELETE'"></sail-account-deletion>
```

Typed-confirmation UX: the destructive button is disabled until the user types the exact `confirmationText` (default `DELETE`) **and** confirms their password. Optional reason textarea is forwarded to the backend. On success, local session is cleared and the router navigates to `config.accountDeletedRoute` (default `/login/local`).

### Logout everywhere

`TrustedDevicesComponent` ships a "Sign out of all devices" button that reveals a password field, then calls `BaseAuthService.logoutEverywhere({ password })` (`POST /api/user/logout-everywhere`). It also displays a single-device-mode banner when configured:

```html
<sail-trusted-devices [singleDeviceSession]="user.singleDeviceSession"></sail-trusted-devices>
```

Pass `singleDeviceSession` from your login response (the field is part of `LoginResponse2FA`). When true, the banner reads: *"This account is in single-device mode — signing in on another device will sign you out here."*

### Push tokens

For mobile apps / web push, register your FCM / APNs token after login:

```typescript
auth.registerPushToken('I', fcmToken, '1.2.3', 'iPhone 15').subscribe();
// On logout or device rotation:
auth.revokePushToken(oldToken).subscribe();
```

Platform codes: `'I'` iOS, `'A'` Android, `'W'` Web. The token acquisition (Capacitor / web-push / Firebase SDK) stays in the consumer app — sail only owns the server call.

| Endpoint | Service method |
|----------|---------------|
| `DELETE /api/user/account` | `deleteAccount(reauth, reason?)` |
| `POST /api/user/logout-everywhere` | `logoutEverywhere(reauth)` |
| `POST /api/push/register` | `registerPushToken(platform, token, appVersion?, deviceModel?)` |
| `POST /api/push/revoke` | `revokePushToken(token)` |

### Suggested styles for auth components

```css
/* Consent gate */
.consent-form { display: flex; flex-direction: column; gap: 12px; }
.consent-row { font-size: 14px; line-height: 1.4; }
.consent-hint { display: block; margin-top: 4px; font-size: 12px; color: #666; }

/* OTP input */
.otp-container { display: flex; flex-direction: column; align-items: center; padding: 16px 24px; }
.otp-sent-to { margin: 0; color: #666; font-size: 14px; }
.otp-contact { margin: 4px 0 24px; font-weight: 600; font-size: 16px; }
.otp-digits { display: flex; gap: 8px; margin-bottom: 16px; }
.otp-digit { width: 40px; height: 48px; border: 2px solid #ddd; border-radius: 8px;
             display: flex; align-items: center; justify-content: center;
             font-size: 20px; font-weight: 600; }
.otp-digit.active { border-color: #1976d2; }
.otp-keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
              width: 100%; max-width: 300px; }
.keypad-key { height: 56px; font-size: 22px; font-weight: 500; border-radius: 12px; }
.keypad-spacer { height: 56px; }

/* Social login */
.social-login { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.social-apple-btn { height: 44px; border-radius: 22px; background: #000; color: #fff;
                    border: 0; font-weight: 600; cursor: pointer; }

/* Trusted devices single-device banner */
.single-device-banner { padding: 12px; border-radius: 8px; background: #fff3cd;
                        color: #856404; margin-bottom: 16px; font-size: 14px; }
```

## Updating to the latest version

```bash
npm update @nauticana/sail
```

Or to install a specific version:

```bash
npm install @nauticana/sail@1.0.7
```

## Migrating to v0.5.0

The downstream code adopting this library was previously written against the legacy frontend library (renamed to sail) targeting basis backend (renamed to keel). v0.5.0 aligns sail with keel v0.5.0 and renames all `Basis*` symbols to `Sail*`. There is no backward-compatibility shim — apply every step below.

### 1. Update `package.json`

```diff
-  "@aspect/gui": "github:nauticana/sail"
+  "@nauticana/sail": "^0.5.0"
```

sail is now on the public npm registry. If your project carries a leftover `.npmrc` pointing at GitHub Packages from the legacy setup, **delete it** — the public registry is the default and no override is needed:

```diff
- @nauticana:registry=https://npm.pkg.github.com
```

### 2. Update `tsconfig.json` paths

```diff
-  "@aspect/gui": ["./node_modules/@aspect/gui/src/index"]
+  "@nauticana/sail": ["./node_modules/@nauticana/sail/src/index"]
```

If your `tsconfig.json` has `"baseUrl": "src"`, the relative path is `"../node_modules/@nauticana/sail/src/index"`.

### 3. Rename imports in your `src/`

Find-and-replace across the entire `src/` tree:

| Replace | With |
|---|---|
| `@aspect/gui` | `@nauticana/sail` |
| `BASIS_GUI_CONFIG` | `SAIL_GUI_CONFIG` |
| `BasisGuiConfig` | `SailGuiConfig` |

Both the injection token and the interface were renamed.

### 4. Update OTP flow — opaque `otpToken` replaces `sessionId`

keel v0.5 issues a server-side opaque `otpToken` from `sendOtp()` instead of returning the raw `sessionId` (`= user_account.id`). The token is bound to the user_id in keel's cache for ~5 minutes. The change closes a user-id brute-force vector and removes the `sessionId` / `isNewUser` enumeration leaks.

Wherever you stored the OTP `sessionId`, swap it for `otpToken: string`.

```diff
- readonly sessionId = signal(0);
+ readonly otpToken = signal('');

  // sendOtp response shape:
- // { sessionId: number; isNewUser: boolean }
+ // { otpToken: string }

  this.auth.sendOtp({ contact: phone, purpose: 'login' }).subscribe({
-   next: (resp) => this.sessionId.set(resp.sessionId),
+   next: (resp) => this.otpToken.set(resp.otpToken),
  });

  // verifyOtp request shape:
- this.auth.verifyOtp({ sessionId: this.sessionId(), code }).subscribe(...)
+ this.auth.verifyOtp({ otpToken: this.otpToken(), code }).subscribe(...)

  // resendOtp signature changed:
- this.auth.resendOtp(this.sessionId()).subscribe();
+ this.auth.resendOtp(this.otpToken()).subscribe();
```

`sendOtp()` always returns 200 — even on unknown contacts on the login path, the response shape is identical (with a server-issued fake token). This is intentional anti-enumeration; verify will fail with a generic 401. No client-side handling needed.

`OtpVerifyResponse` no longer carries `isNewUser`. If your app branches on first-time-user, detect it after the JWT lands by inspecting your own user-state load.

### 5. Update consumer subscriptions

`BackendService.list<T>()` returns `Observable<T[]>` (unchanged). It now expects keel to return paginated `{items, limit, offset, total}` and has dropped the legacy "bare array" fallback. If you have an in-house wrapper that calls keel `list` endpoints directly, expect the wrapper shape.

For pagination metadata, use `listPaginated<T>()`:

```typescript
backend.listPaginated<MyRow>('orders', { _limit: '50', _offset: '0' })
  .subscribe(page => {
    this.rows.set(page.items);
    this.total.set(page.total);
  });
```

### 6. Optional: replace deprecated bootstrap

If you bootstrapped with `provideZoneChangeDetection`, switch to `provideZonelessChangeDetection` (Angular 21 default). The shipped `@nauticana/sail` components are signal-based and zoneless-safe.

### 7. Clean install

```bash
rm -rf node_modules package-lock.json
npm install
ng build
```

Type errors after upgrade fall into two buckets:

- **`Cannot find name 'BasisGuiConfig'`** — you missed a rename in step 3. Search again.
- **`Property 'sessionId' does not exist on type 'OtpResponse'`** — finish step 4 in the file flagged.

### 8. Backend alignment

This library only talks to keel **v0.5.x**. Older keel servers will reject the `otpToken` field on verify with HTTP 400. Upgrade keel and sail together. See [keel/README.md → Migration Guide](https://github.com/nauticana/keel/blob/main/README.md) for the matching backend changes.

## Migrating to v0.7.0 — payout, user payment methods, table actions

The v0.6 / v0.7 line introduced three additive feature groups against keel v0.7.x. All net-new exports; no breaking changes from v0.5.x. Pull what you need.

| Version | Surface |
|---|---|
| **v0.6.0** | Payout onboarding (KYC) + multi-partner account reuse |
| **v0.6.1** | End-user saved payment methods (cards / wallets) |
| **v0.7.0** | `TableAction` — backend-defined custom buttons on table screens |

### 1. New exports

| From | Export | Purpose |
|---|---|---|
| `@nauticana/sail` | `PayoutService` | keel/payout API client — onboarding, reuse, status, bank-version replacement, beneficiary registration |
| `@nauticana/sail` | `PayoutProviderOnboardingComponent` (`<sail-payout-provider-onboarding>`) | Drop-in onboarding step with reuse picker, hosted-KYC handoff, and asynchronous-confirmation output |
| `@nauticana/sail` | `PayoutBankInfoFormComponent` (`<sail-payout-bank-info-form>`) | Tax + payout details form (country / currency / tax ID / billing address / agreement) |
| `@nauticana/sail` | `UserPaymentMethodService` | Saved-card list / delete / set-default API client |
| `@nauticana/sail` | `UserPaymentMethodsComponent` (`<sail-user-payment-methods>`) | List of saved cards/wallets with set-default + delete |
| `@nauticana/sail` | `TableAction`, `ReusableAccount`, `PayoutOnboardingSession`, `BankInfoFormValue`, `CountryProfile`, `UserPaymentMethod`, `DEFAULT_COUNTRY_PROFILES` | Model types / defaults |

### 2. New keel endpoints

Make sure your keel deployment exposes these — they're all under `/api/v1/`:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/payout/onboard/start` | POST | Start provider onboarding; returns `{ url, externalAccountId, expiresAt }` (`url` is empty when confirmation continues asynchronously) |
| `/api/v1/payout/reusable` | POST | List provider accounts the user has on other partners |
| `/api/v1/payout/reusable/link` | POST | Copy a `providerAccountId` onto the active partner's `user_bank_info` row |
| `/api/v1/payout/status` | POST | `{ complete: true }` once the active partner's row has a `providerAccountId` |
| `/api/v1/payout/bank/replace` | POST | Supersede the active bank-info version and insert its replacement atomically; the app must wire the handler's `SealTaxID` hook |
| `/api/v1/payout/beneficiary/register` | POST | Create and link a provider beneficiary from provider-collected details |
| `/api/v1/payment-methods/set-default` | POST | Atomic multi-row UPDATE — sets one row as default, clears the rest |
| `/api/v1/{table}/{action_name}` | POST | Per-table custom actions resolved from `basis.table_action` |

`list` / `delete` for the `user_payment_method` table go through keel's generic REST CRUD (`/api/v1/user_payment_method/list|delete`) — `user_payment_method` is a UserSpecific basis table, so keel auto-scopes reads to the caller and owner-locks DELETE. No custom endpoint needed for those two.

### 3. Payout onboarding wiring

Drop the two components into a wizard step. Routing between them stays in the consumer app — sail emits events, doesn't navigate.

```html
@switch (step()) {
  @case ('bank') {
    <sail-payout-bank-info-form
        (submitted)="onBankInfo($event)"
        (back)="step.set('plan')">
    </sail-payout-bank-info-form>
  }
  @case ('provider') {
    <sail-payout-provider-onboarding
        (linked)="step.set('done')"
        (started)="step.set('waiting')"
        (pending)="step.set('awaiting-confirmation')"
        (skipped)="step.set('done')"
        (back)="step.set('bank')">
    </sail-payout-provider-onboarding>
  }
}
```

`BankInfoFormValue` is application-layer input, not a generic-CRUD row. In particular, its plaintext `taxId` must be sealed into the `tax_id_encrypted` column and must never be sent through the generic `/api/v1/user_bank_info` CRUD surface. First-time setup goes through the consuming app's registration service. Changes to an existing destination use `PayoutService.replaceBankInfo()`, which calls keel's atomic version-replacement endpoint; wire `PayoutHandler.SealTaxID` so that endpoint seals the plaintext before persistence.

`PayoutService.startOnboarding()` returns a `PayoutOnboardingSession`. When `url` is non-empty, the component emits `started` and navigates to the provider's hosted flow. When `url` is empty, as with Wise email recipients, it emits `pending` instead; consumers must show an awaiting-confirmation state while the recipient completes the provider's email flow. Airwallex apps can pass details collected by the embedded beneficiary component to `PayoutService.registerBeneficiary()`.

For apps that operate on a single keel partner, the reuse picker stays empty and only the "Start onboarding" CTA renders. Multi-partner apps get the picker for free.

### 4. Saved payment methods wiring

```html
<sail-user-payment-methods
    [title]="'Payment Methods'"
    (addClicked)="goToSetupIntent()"
    (defaultChanged)="onDefaultChanged($event)"
    (deleted)="onDeleted($event)">
</sail-user-payment-methods>
```

`(addClicked)` is the only event you must wire — sail intentionally does **not** ship a SetupIntent UI (providers differ too much; consumer flows them through Stripe Elements / Apple Pay / Google Pay / etc.). Listen for the event and route to your own SetupIntent screen.

### 5. TableAction — backend-defined per-table actions

v0.7.0 surfaces a new `TableAction` channel: keel's REST engine ships per-table action buttons from `basis.table_action`. The shipped `TableList`, `TableSearch`, `TableEdit`, and `TableDetail` templates render these automatically (toolbar for table-level actions, per-row icon buttons for record-specific ones). Authorization gating mirrors `canRead`/`canCreate` etc. — `canExecuteAction(action)` is checked against `(authorityObject, authorityCheck, table_name)`.

For your own components that subclass `BaseView` / `BaseForm`, expose the same buttons in your templates:

```html
@for (action of getActions(false); track action.action) {
  @if (canExecuteAction(action)) {
    <button matButton="outlined" type="button"
            [title]="action.caption"
            (click)="executeAction(action)">
      @if (action.icon) { <mat-icon>{{ action.icon }}</mat-icon> }
      {{ action.caption }}
    </button>
  }
}

@for (action of getActions(true); track action.action) {
  @if (canExecuteAction(action)) {
    <button matIconButton type="button"
            [title]="action.caption"
            (click)="executeAction(action, record)">
      <mat-icon>{{ action.icon || 'play_arrow' }}</mat-icon>
    </button>
  }
}
```

`executeAction()` is provided by sail's table components (it POSTs the row's primary-key columns to `action.method`). If you wrote your own subclass and want the same behaviour, inject `BackendService` and call `backendService.executeAction(action.method, body)`. The `body` is `{}` for table-level actions and the row PK (via `primaryKeyValues(record)`) for record-specific ones.

### 6. Backend alignment

v0.6 / v0.7 require keel **v0.7.x**. The earlier `keel v0.5.x` server doesn't expose `/api/v1/payout/*`, `/api/v1/payment-methods/set-default`, or the `basis.table_action` seed data. Upgrade keel and sail together.

## Migrating to v0.8.0 — signal-driven modernization

v0.8.0 finishes the Angular-signals migration that v0.5–v0.7 started incrementally. Every `@Input()` / `@Output()` decorator, `EventEmitter`, plain-field-on-`BaseTable` access, and legacy Material M2 button selector is gone. Downstream code that extends sail's abstract classes or copies its template patterns will need the steps below — there is no shim.

The TS-side core peer requirements bump with this release:

| | v0.7.x | v0.8.x |
|---|---|---|
| Angular | `^21.0.0` | `^21.2.0` |
| TypeScript | `~5.9.2` | `~6.0.3` |

### 1. `BaseTable.tableName` is now a `WritableSignal<string>`

The single highest-impact change. Before:

```typescript
// BaseTable
tableName = '';

// Subclass
@Input() override tableName = '';

// In your code
if (this.tableName === 'orders') { ... }
this.tableName = 'orders';

// In your template
[tableName]="tableName"
{{ tableName }}
```

After:

```typescript
// BaseTable
readonly tableName: WritableSignal<string> = signal('');

// In your code
if (this.tableName() === 'orders') { ... }
this.tableName.set('orders');

// In your template
[tableName]="tableName()"
{{ tableName() }}
```

If your subclass exposes `tableName` as a route/parent input, declare an aliased `input()` and sync it into the inherited signal in the constructor:

```typescript
import { effect, input } from '@angular/core';

export class YourTableComponent extends BaseForm {
  readonly tableNameInput = input('', { alias: 'tableName' });

  constructor() {
    super();
    effect(() => {
      const v = this.tableNameInput();
      if (v) this.tableName.set(v);
    });
  }

  ngOnInit() {
    // Route-data fallback now uses .set(), not assignment:
    if (!this.tableName() && data['tableName']) this.tableName.set(data['tableName']);
  }
}
```

### 2. `BaseView.apiName` and `BaseView.dialogComponent` are signals too

Same migration path as `tableName`. The TableList/TableLookup pattern in v0.5–v0.7 read these as plain strings and assigned in `ngOnInit`; they are now `WritableSignal<string>` / `WritableSignal<any>`. Update subclass code:

```diff
- if (!this.apiName && data['apiName']) this.apiName = data['apiName'];
- this.backendService.list<MyRow>(this.apiName, terms).subscribe(...);
+ if (!this.apiName() && data['apiName']) this.apiName.set(data['apiName']);
+ this.backendService.list<MyRow>(this.apiName(), terms).subscribe(...);
```

If you bind `[apiName]` / `[dialogComponent]` on a sail subclass from a parent template, declare aliased inputs and sync via `effect()`, exactly like `tableNameInput` above.

### 3. `@Input()` / `@Output()` → `input()` / `output()`

Every decorator-based input/output across sail is now signal-based. Update your own components to match. The signal-input requires calling the field as a function inside the class and in templates.

```diff
- @Input() title = 'Payments';
- @Output() saved = new EventEmitter<Payment>();
+ readonly title = input('Payments');
+ readonly saved = output<Payment>();

  // class body
- this.title           // string
- this.saved.emit(p);
+ this.title()         // string (signal read)
+ this.saved.emit(p);  // unchanged

  // template
- {{ title }}
+ {{ title() }}
```

`EventEmitter` is no longer imported from `@angular/core` in sail; outputs created with `output<T>()` are returned as `OutputEmitterRef<T>` with the same `.emit(v)` API.

For inputs whose **parent value can change at runtime** and you also want a local writable copy (the old "default value, then override in `ngOnInit`" pattern), use the alias + effect template above. If you only need the parent value reactively, just call `this.foo()` everywhere.

### 4. Inline component templates moved to sibling `.html`

`UserPaymentMethodsComponent`, `PayoutBankInfoFormComponent`, and `PayoutProviderOnboardingComponent` no longer ship inline `template:` strings — they reference `templateUrl: './*.html'` in the same folder. The compiled output is identical; downstream consumers that just import the component classes need no change. If you have a fork that edits these templates inline, port your edits into the new `.html` files.

### 5. Clean install + recompile

```bash
rm -rf node_modules package-lock.json
npm install
ng build
```

Type errors after the upgrade fall into four buckets:

- **`This expression is not callable. Type 'String' has no call signatures.`** — a template still reads `tableName` / `apiName` as a plain field. Add `()`. See step 1.
- **`Cannot assign to 'tableName' because it is a read-only property.`** — a subclass declared `readonly tableName = input('')`, conflicting with the inherited writable signal. Use the `tableNameInput = input('', { alias: 'tableName' })` + `effect()` pattern from step 1 instead.
- **`Property 'X' does not exist on type 'EventEmitter<T>'.`** — you still import `EventEmitter`. Replace the field with `output<T>()` per step 3.
- **`'@Input' is deprecated`** / Angular language-service squiggles on decorators — step 3.

## Migrating to v0.8.1 — selector standardisation, OOP cleanup, keel v0.8.3 alignment

v0.8.1 is a polish pass on top of v0.8.0's signal migration. The biggest change is **the component selector prefix**: every sail component is now `sail-*`, where v0.8.0 still shipped a mix of `app-*` (older components) and `sail-*` (the v0.6 / v0.7 additions). The rest of the release is internal OOP cleanup that's mostly invisible to downstream code, plus a TypeScript downgrade and a keel pin.

| | v0.8.0 | v0.8.1 |
|---|---|---|
| keel | `v0.8.0` | `v0.8.3` |
| TypeScript | `~6.0.3` | `~5.9.3` |
| Component selector prefix | `app-*` (older) + `sail-*` (newer) | `sail-*` (uniform) |

### 1. Selector rename — `app-*` → `sail-*` (and `table-*` / `dynamic-field` / `record-form` → `sail-*`)

Every sail component selector now starts with `sail-`. **This is the breaking change**: any downstream template that embeds a sail component needs the prefix updated. Search-and-replace across your templates:

| Old | New |
|---|---|
| `<app-navigation>` | `<sail-navigation>` |
| `<app-login>` | `<sail-login>` |
| `<app-register>` | `<sail-register>` |
| `<app-chpass>` | `<sail-chpass>` |
| `<app-confirm-register>` | `<sail-confirm-register>` |
| `<app-confirm-chpass>` | `<sail-confirm-chpass>` |
| `<app-twofactor-setup>` | `<sail-twofactor-setup>` |
| `<app-twofactor-verify>` | `<sail-twofactor-verify>` |
| `<app-trusted-devices>` | `<sail-trusted-devices>` |
| `<app-account-deletion>` | `<sail-account-deletion>` |
| `<app-consent-gate>` | `<sail-consent-gate>` |
| `<app-otp-input>` | `<sail-otp-input>` |
| `<app-social-login>` | `<sail-social-login>` |
| `<app-plan-selector>` | `<sail-plan-selector>` |
| `<app-checkout-button>` | `<sail-checkout-button>` |
| `<app-payment-methods>` | `<sail-payment-methods>` |
| `<table-list>` | `<sail-table-list>` |
| `<table-search>` | `<sail-table-search>` |
| `<table-edit>` | `<sail-table-edit>` |
| `<table-detail>` | `<sail-table-detail>` |
| `<table-lookup>` | `<sail-table-lookup>` |
| `<table-report>` | `<sail-table-report>` |
| `<table-form>` | `<sail-table-form>` |
| `<record-form>` | `<sail-record-form>` |
| `<dynamic-field>` | `<sail-dynamic-field>` |

The payout / user-payment-method selectors (`<sail-payout-bank-info-form>`, `<sail-payout-provider-onboarding>`, `<sail-user-payment-methods>`) were already on `sail-*` in v0.7.0 — no change there.

**Why:** the Angular style guide assigns `app-*` to the consumer application (Angular CLI defaults to it for new components). A library shipping `app-*` selectors collides with the downstream's own components and reads ambiguously in mixed templates. v0.8.1 makes the prefix uniform across sail and unambiguous against your code.

### 2. Internal: TableAction template-method pull-up

`executeAction()` was duplicated three times across `TableList`, `TableSearch`, and `TableDetail` in v0.8.0. v0.8.1 moves the body into `BaseTable` with two `protected` hooks:

```typescript
protected beforeExecuteAction(action: TableAction, record?: Record<string, unknown>): boolean { return true; }
protected onActionSuccess(action: TableAction, record?: Record<string, unknown>): void { /* no-op */ }
```

**For your subclasses:** if you have a custom view that extends `BaseTable` / `BaseForm` / `BaseView` and renders the action toolbar, you no longer write your own `executeAction()` — inherit it. Override `onActionSuccess()` to refresh your screen (the way `TableList` re-fetches) and `beforeExecuteAction()` to add per-screen pre-flight guards (the way `TableDetail` blocks unsaved rows).

**For your templates:** unchanged. Action buttons still call `(click)="executeAction(action, record)"`.

**Bonus:** `TableEdit` now renders per-record actions too (v0.8.0 was missing them) and re-fetches the record after a successful action.

### 3. Internal: `BaseAsync` pulled up onto 5 more components

`ChpassComponent`, `ConfirmChpassComponent`, `ConfirmRegisterComponent`, `TwoFactorSetupComponent`, and `TwoFactorVerifyComponent` were re-declaring their own `errorMessage` / `successMessage` signals and hand-rolled subscribe blocks. They now `extends BaseAsync` and use `this.run(obs, onSuccess, fallback)` — public template API is unchanged (`{{ errorMessage() }}` / `{{ successMessage() }}` still work).

### 4. Internal: `BaseRestService` + `requireAuth()` + `openRecordDialog()` + `linkedSignal` alias-inputs

- **`BaseRestService`** (`src/service/base_rest.service.ts`) owns the shared `inject(HttpClient)` and `url(path)` helper. `BackendService`, `BaseAuthService`, `BillingService`, `PayoutService`, and `UserPaymentMethodService` all extend it. The 27 hand-spelled `RestURL.httpHost + RestURL.xURL` getters in `BaseAuthService` are now `readonly` fields built via `this.url(...)`.
- **`BaseTable.requireAuth(check, verb)`** replaces 8 copies of `alert('Missing authorization to … records')` across the codebase.
- **`BaseView.openRecordDialog(record, isNew)`** collapses the duplicated `addRecord` / `editRecord` dialog-open bodies.
- **`linkedSignal`** replaces the v0.8.0 `input() + signal + effect()` pattern across `TableList`, `TableSearch`, `TableEdit`, `TableDetail`, and `DynamicField`. One-line declarations per field; behaviour is unchanged (empty input doesn't override a `.set()` value).

If your downstream component extends `BaseTable` / `BaseView` and uses the alias-input pattern from v0.8.0 (`input + effect`), you can optionally migrate to `linkedSignal` — but the old pattern still compiles.

```typescript
import { input, linkedSignal } from '@angular/core';

export class MyView extends BaseView {
  // Aliased input MUST be public — Angular's strict template type-checker
  // resolves `[tableName]="x"` from a parent template back to this field
  // by name, and a `private` / `protected` modifier rejects the binding
  // with TS2445. The override signal can be any visibility.
  readonly tableNameInput = input('', { alias: 'tableName' });

  override readonly tableName = linkedSignal<string, string>({
    source: () => this.tableNameInput(),
    computation: (v, prev) => v || prev?.value || '',  // preserve .set() when input goes empty
  });
}
```

The `computation` callback runs whenever the source changes. Returning `v || prev?.value` gives "use the bound value if provided, else keep the last non-empty value we had locally" — same semantics the v0.8.0 `effect()` carried.

### 5. Internal: `BaseTable.caption` is no longer memoised; `Navigation.allMenuItems` via `toSignal`

`getCaption()` and `colCaption()` previously cached on first read, so `tableName` updates after first render returned stale captions. They now recompute each call (cost is negligible). `Navigation` reads `allMenuItems` via `toSignal(getMenus(), { initialValue: [] })` instead of a manual `subscribe` in `ngOnInit`.

### 6. TypeScript pinned to `~5.9.3`

`@angular/compiler-cli@21.2` declares `typescript >=5.9 <6.1` as a peer, but downstream projects report that TS `6.0.3` requires `--legacy-peer-deps` on `npm install` because of transitive package mismatches. To keep the install path clean for all consumers, v0.8.1 pins to `~5.9.3`. Bump your downstream's `package.json` to match:

```diff
- "typescript": "~6.0.x"
+ "typescript": "~5.9.3"
```

### 7. Clean install + recompile

```bash
rm -rf node_modules package-lock.json
npm install
ng build
```

Expected errors after the upgrade:

- **`'app-*' is not a known element`** — selector rename, see step 1.
- **`'@Output' is deprecated`** — leftover from the v0.8.0 migration; finish it.
- **`peerinvalid` / `--legacy-peer-deps` prompts on `npm install`** — your project still has TS 6.x. Downgrade per step 6.
- **`TS2445: Property 'xInput' is protected and only accessible within class …`** during `ng build` from a downstream project, pointing at sail's own `*.html` files (e.g. `[tableName]="..."` in `table_edit.html`) — upgrade to sail `v0.8.1` patch (published after the initial v0.8.1 cut) where the aliased input fields are public. The cause: Angular's strict template type-checker resolves the alias back to the declared field, so `input('', { alias: 'tableName' })` declared as `protected readonly tableNameInput` is unreachable from the parent template that binds `[tableName]=…`. The fix in your own subclasses, if you copied the v0.8.1 pattern: drop the `protected` / `private` modifier on any aliased `input()` field, leave it `readonly`.

### 8. Backend alignment

v0.8.1 targets **keel v0.8.3**. The shared keel API surface didn't grow in this release; the version pin tracks keel's matching v0.8.x line. See [keel/README.md → Migration Guide](https://github.com/nauticana/keel/blob/main/README.md) for the matching backend changes.

## Migrating to v0.8.2 — server-driven OTP resend cooldown

Additive change. v0.8.1 consumers keep compiling.

### What changed

`OtpResponse` (model/auth.ts) gained an optional `resendCountdownSec?: number` field. keel v0.8.4 populates it from `--otp_ttl_seconds` so the resend timer in `OtpInputComponent` can match the OTP code's actual server-side lifetime instead of relying on the client-side fallback (still 30s for back-compat with older keel deployments / dev mocks that don't return the field).

```ts
export interface OtpResponse {
  otpToken: string;
  resendCountdownSec?: number;   // NEW — present when keel >= v0.8.4
}
```

`OtpInputComponent.resendCountdownSec` (input, default 30) is **unchanged**. The recommended pattern is for the page that calls `sendOtp` to capture `res.resendCountdownSec` from the response and pass it to the input so the timer reflects server intent.

### Adoption

Two-step plumbing on the page that owns the OTP screen:

1. **Capture from the send response.** After `auth.sendOtp({...}).subscribe(...)`, store `res.resendCountdownSec` in component state and forward it via router state when navigating to the confirm screen.

   ```ts
   this.auth.sendOtp({ contact, contactType, purpose: 'login' }).subscribe({
     next: (res) => {
       this.router.navigate(['/login/confirm'], {
         state: {
           otpToken: res.otpToken,
           contact,
           resendCountdownSec: res.resendCountdownSec,   // forward server value
         },
       });
     },
   });
   ```

2. **Read on the confirm screen + bind to the input.** Default a local signal to 30 (the legacy fallback) so older keels and the dev OTP mock keep working, then overwrite from router state and from `onResend` responses.

   ```ts
   readonly resendCountdownSec = signal(30);

   constructor() {
     const state = this.router.getCurrentNavigation()?.extras.state;
     if (state && typeof state['resendCountdownSec'] === 'number') {
       this.resendCountdownSec.set(state['resendCountdownSec']);
     }
   }

   onResend() {
     this.auth.sendOtp({...}).subscribe({
       next: (res) => {
         if (typeof res.resendCountdownSec === 'number') {
           this.resendCountdownSec.set(res.resendCountdownSec);
         }
       },
     });
   }
   ```

   ```html
   <sail-otp-input
     [contact]="contact()"
     [resendCountdownSec]="resendCountdownSec()"
     (codeComplete)="verifyOtp($event)"
     (resend)="onResend()" />
   ```

### Backend alignment

v0.8.2 targets **keel v0.8.4**. The new `resendCountdownSec` response field is documented in [keel/README.md → Migration Guide (v0.8.4)](https://github.com/nauticana/keel/blob/main/README.md). Sail will tolerate older keels that don't return the field — the input falls back to its 30s default.

## Migrating to v0.9.0 — server-set trusted-device cookie

**Breaking change.** v0.9.0 adopts keel's v0.9 trusted-device model: the "trust this device" credential moves from a client-supplied `deviceFingerprint` string to a server-minted, HttpOnly `keel_td` cookie. This closes two weaknesses in the old scheme — the client picked the fingerprint value (so a malicious client could replay a known fingerprint across users), and keel stored it in plaintext (so a DB leak handed an attacker direct 2FA-bypass material). The new secret is server-generated, returned only via `Set-Cookie`, and stored as a SHA-256 hash.

This release targets **keel v0.9** (the "bdsmail upstream" trusted-device rework). It will **not** interoperate correctly with keel < v0.9 — older keels expect the `deviceFingerprint` field that sail no longer sends, so "trust this device" silently fails. Upgrade the backend in lockstep.

### What changed in the public API

| Symbol | Before (v0.8.x) | After (v0.9.0) |
|---|---|---|
| `BaseAuthService.login()` | `login(username, password, deviceFingerprint?)` | `login(username, password)` |
| `BaseAuthService.verify2FALogin()` | `verify2FALogin(code, trustDevice?, deviceFingerprint?, deviceName?)` | `verify2FALogin(code, trustDevice?, deviceName?)` |
| `TwoFactorVerifyRequest` (model) | had `deviceFingerprint?: string` | field removed |
| `TrustedDevice` (model) | had `fingerprint: string` | field removed (keel no longer returns it — it was the bypass credential) |

`trustDevice` and `deviceName` are unchanged — `deviceName` is still a real field keel records as the human-readable label in the trusted-device list.

### Migration steps

Most consumers use sail's bundled `LoginComponent` / `TwoFactorVerifyComponent` and **need no code changes** — those components were updated internally. Steps below apply only if you call the auth API directly or wrap these components.

1. **Drop the `deviceFingerprint` argument** from any direct call to `login()` or `verify2FALogin()`:

   ```diff
   - this.auth.login(username, password, this.getDeviceFingerprint());
   + this.auth.login(username, password);

   - this.auth.verify2FALogin(code, trustDevice, this.getDeviceFingerprint(), deviceName);
   + this.auth.verify2FALogin(code, trustDevice, deviceName);
   ```

2. **Delete any client-side fingerprint generation.** The old `crypto.randomUUID()` → `localStorage['deviceFingerprint']` pattern is dead — the server owns the credential now. You can also clear the stale key:

   ```ts
   localStorage.removeItem('deviceFingerprint');
   ```

3. **Stop reading `TrustedDevice.fingerprint`.** It no longer exists on the type. If you rendered a "this device" badge by comparing it to a stored fingerprint, **remove that** — the credential is an HttpOnly cookie, so JavaScript cannot read it and the current device is no longer identifiable client-side. sail removed the badge from its own `TrustedDevicesComponent`.

4. **Confirm credentialed CORS on the backend.** This is the one operational step that is easy to miss. The `keel_td` cookie only round-trips on credentialed requests. sail sends `withCredentials: true` automatically, but the keel `HttpBackend` must cooperate — see [Enabling 2FA → Cross-origin cookie requirement](#cross-origin-cookie-requirement). Same-origin deployments need nothing; cross-origin deployments need `AllowCredentials: true` and an exact (non-wildcard) `Origin`.

### Existing trusted-device rows

No data migration needed. Rows written under the old plaintext-fingerprint scheme will never match the new hashed lookup and expire naturally via their 30-day `expires_at`. Affected users are prompted for 2FA on their next login and can re-opt into "trust this device". (Backends that want to clean up early: `DELETE FROM user_trusted_device WHERE LENGTH(device_fingerprint) <> 64` — new hashes are exactly 64 hex chars.)

### Backend alignment

v0.9.0 targets **keel v0.9**. The full backend contract is documented in [keel/README.md → Trusted-device model (v0.9) and Migration from v0.8 trusted-device API](https://github.com/nauticana/keel/blob/main/README.md). Verify your backend sets `AllowCredentials` (cross-origin only) before rolling out.

## Migrating to v1.0.7 — interceptor scoping, 2FA-verify return type

Additive for the bundled components; the notes below apply only if you call the auth API directly or relied on the interceptors mutating non-keel traffic.

- **Interceptors are now scoped to the keel host.** `authInterceptor` only attaches the JWT to the configured backend's `/api/` URLs (set via `configureRestUrls(host)`), and `apiResponseInterceptor` only unwraps / passes through responses from keel URLs. Requests to other origins are left untouched — the JWT no longer leaks to a third-party URL that merely contains `/api/`. If you routed non-keel calls through these interceptors expecting them to mutate the payload, handle that in your own interceptor.
- **`apiResponseInterceptor` preserves the original error shape.** It no longer flattens `HttpErrorResponse.error` to a string, so `err.error.detail` / `err.error.message` (keel's RFC 7807 ProblemDetail) reach your components intact — matching what `BaseAsync` already reads.
- **`verify2FALogin()` now returns `Observable<TwoFactorVerifyResponse>`** instead of subscribing internally and returning `void` — mirroring `verifyBackupCode()`, so a component can show loading / invalid-code state. **You must subscribe** for the request to fire. The bundled `TwoFactorVerifyComponent` is already updated; only direct callers need to change:

  ```diff
  - this.auth.verify2FALogin(code, trustDevice, deviceName);
  + this.auth.verify2FALogin(code, trustDevice, deviceName).subscribe();
  ```

- **`<sail-checkout-button>` `priceId` is now optional**, so setup-mode (save-card) works as documented — omit `[priceId]` for `[mode]="'setup'"`. Subscription / payment modes without a price now surface an inline error instead of a 400.

## Modernization items

When you extend sail in your own app, apply the same patterns sail itself follows. Downstream projects that copied templates or scaffolding from earlier sail versions will benefit from the same sweep. This list is a checklist — none are sail-specific.

### Templates

- **Native control flow.** Use `@if` / `@for` / `@switch` / `@let` blocks. `*ngIf`, `*ngFor`, `*ngSwitch` are legacy.
- **Bindings, not directives, for class / style.** `[class.foo]="cond"`, `[style.width.px]="n"` — don't use `ngClass` / `ngStyle`.
- **Material 21 M3 button selectors.** See step 5 above. `mat-raised-button` / `mat-stroked-button` etc. work but are not the current API.
- **No `color="primary|accent|warn"` on Material components.** Use the `.primary` / `.accent` / `.warn` global CSS classes.
- **Template spread inside expressions** (Angular 21). When you have a TS helper that only exists to merge objects for a binding, fold it into the template: `[config]="{ ...base, label: 'Override' }"`, `[items]="[...defaults, ...extra]"`, `[out]="fn(...args)"`. (Note: only valid inside array literals, object literals, or call expressions — there is no JSX-style host-attribute spread.)
- **No structural directive on the same element as a component selector.** Already enforced by native control flow.

### Components and directives

- **Signal-based inputs/outputs.** `input()` / `output()` instead of `@Input()` / `@Output()`. Read as `this.x()` / `{{ x() }}`. **Keep `input()` / `output()` fields publicly accessible** (`readonly` without `private`/`protected`). Angular's strict template type-checker resolves an `{ alias: 'foo' }` back to the declared field name and rejects parent bindings against a non-public field with TS2445.
- **`model()` for two-way bindings.** When the parent needs `[(value)]` binding semantics, declare `value = model('')` rather than rolling your own `@Output() valueChange`.
- **`inject()` for dependencies.** No constructor parameter injection. Field-level `inject(Token)` keeps the constructor zero-arg and lets the class be subclassed without parameter forwarding.
- **`ChangeDetectionStrategy.OnPush` on every component.** Signal-based code is fully compatible with OnPush; without it, change detection still runs needlessly.
- **`host: { ... }` metadata, not `@HostBinding` / `@HostListener`.** Same effect, no decorators.
- **Omit `standalone: true`.** It's the default in Angular v20+. Setting it explicitly is noise.
- **Move HTML and styles to sibling files** when they grow past a few lines (`templateUrl: './*.html'`, `styleUrl: './*.scss'` or `styles: '...'`).

### State and reactivity

- **`signal()` for component state**, `computed()` for derived state, `effect()` for side effects that depend on signals. Don't roll your own `BehaviorSubject` for local UI state.
- **`linkedSignal()`** for "use this input value by default, but allow local override" patterns.
- **`takeUntilDestroyed()`** on long-lived observables (`valueChanges`, `route.queryParams`, `route.paramMap`, custom intervals). One-shot HTTP requests can skip it, but `valueChanges` and route streams must have it. Call it in a constructor or other injection context.
- **`toSignal()`** for converting an `Observable<T>` into a signal at component boundaries — useful for `BillingService.listPlans()` and similar one-shots you read in templates.
- **No `mutate()` on signals** — it was removed. Use `update(fn)` or `set(newValue)`.

### Router

- **Standalone `isActive(url, router, options?)` function** from `@angular/router`. Returns `Signal<boolean>`. `Router.prototype.isActive(...)` was `@deprecated` in Angular 21.1.
- **`provideRouter([...])` for bootstrap.** No `RouterModule.forRoot`.
- **Component input binding** for route params: enable `withComponentInputBinding()` and declare `id = input.required<string>()` on the routed component — drops the `ActivatedRoute` injection.

### HTTP

- **`provideHttpClient(withInterceptors([...]))`.** No `HttpClientModule`.
- **Functional interceptors**, not class-based — sail's `authInterceptor` and `apiResponseInterceptor` are already functional; follow the same shape for your own.

### Forms

- **Reactive forms over template-driven.** sail uses `FormGroup` / `FormBuilder` throughout.
- **`fb.nonNullable.group({...})`** for strict typing. Avoids `string | null` everywhere.

### Bootstrap

- **`bootstrapApplication()` with standalone components.** No `@NgModule`, no `AppModule`.
- **`provideZonelessChangeDetection()`** — Angular 21's default. sail's components are signal-based and zoneless-safe.

### Images

- **`NgOptimizedImage`** for static `<img>` with known dimensions. **Exception:** base64 / data URIs aren't supported by `NgOptimizedImage` — use a plain `<img>` for those (the 2FA QR code in `TwoFactorSetupComponent` is the canonical case).

### Tooling

- **TypeScript `~6.0.3`** — within Angular 21.2's `>=5.9 <6.1` peer range. Bump from `~5.9.x`.
- **`@angular/*` `^21.2.0`** for the matching set: core, common, compiler, forms, router, cdk, material.
- **`npm update`** periodically to pull patch releases within the caret range.
