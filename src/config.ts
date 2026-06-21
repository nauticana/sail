import { InjectionToken, Type } from '@angular/core';
import { Routes } from '@angular/router';
import { ApplicationData } from './model/appdata';

export interface RouteLink {
  label: string;
  routerLink: string;
}

export interface TableOverride {
  /** Fields to hide from edit forms in addition to global hiddenFields. Use PascalName. */
  hiddenFields?: string[];
  /**
   * Default values applied to new records. Use PascalName.
   * Values may be a literal or a zero-arg function (evaluated at record creation).
   * Use a function for time-sensitive defaults like `() => new Date().toISOString()`.
   */
  defaultValues?: { [field: string]: unknown | (() => unknown) };
  /**
   * Timestamp columns that look auto-managed (HasDefault + DataType=timestamp)
   * but are actually user-meaningful (e.g. begda, start_date, end_date).
   * Listing them here keeps them visible and editable in forms;
   * they're otherwise filtered out as audit columns.
   */
  editableTimestamps?: string[];
}

export interface SailGuiConfig {
  opField: string;
  hiddenFields: string[];
  restUrls?: { [key: string]: string };
  publicRoutes?: Routes;
  extraRoutes?: (data: ApplicationData) => Routes;
  dashboardComponent?: Type<any>;
  appTitle?: string;
  googleMapsApiKey?: string;
  loginFooterLinks?: RouteLink[];
  /** Links shown in navigation toolbar when not logged in (e.g., Login, Register) */
  publicRouteLinks?: RouteLink[];
  /** Link shown in the toolbar before Logout when logged in, e.g. {label:'My Account', routerLink:'/account'}. Omitted → not shown. */
  accountLink?: RouteLink;
  /** Map RestUri (or prefix pattern like 'analytic/*') to a custom component */
  menuItemRouteOverrides?: { [restUriPattern: string]: Type<unknown> };
  /** Per-table overrides for hiding fields / seeding defaults. Keyed by table PascalName. */
  tableOverrides?: { [tableName: string]: TableOverride };

  // ── Social / consent / account-deletion config ──
  /** Google Identity Services client ID. Required to render the Google button in SocialLoginComponent. */
  googleClientId?: string;
  /** Apple Services ID (Apple Developer → Identifier → Services ID). Required for the Apple button. */
  appleServiceId?: string;
  /** Apple Sign-In redirect URI. Must match the Services ID configuration. */
  appleRedirectUri?: string;
  /** Public URL of your privacy policy. Shown as a link in ConsentGateComponent. */
  privacyPolicyUrl?: string;
  /** Content hash / version of the currently-deployed privacy policy. */
  defaultPolicyVersion?: string;
  /** ISO 639-1 language code of the policy variant shown ('en', 'fr', ...). */
  defaultPolicyLanguage?: string;
  /** Route to navigate to after account deletion. Defaults to '/login/local'. */
  accountDeletedRoute?: string;

  // ── OAuth authorization-flow bridge (for an OAuth AS on a different host) ──
  /** Backend path that mirrors the bearer JWT into an HttpOnly session cookie so
   * a cross-site OAuth `/authorize` can see the session, e.g. '/api/v1/auth/session-cookie'.
   * When set, login POSTs here before handing off to an allowed ?return= host. */
  sessionCookieUrl?: string;
  /** Hostnames a post-login `?return=` may redirect to (open-redirect allowlist),
   * e.g. ['mcp.daxoom.com']. Anything not listed is ignored. */
  allowedReturnHosts?: string[];
}

export const SAIL_GUI_CONFIG = new InjectionToken<SailGuiConfig>('SailGuiConfig');

export const DEFAULT_CONFIG: SailGuiConfig = {
  opField: 'op_code',
  hiddenFields: ['op_code', 'PartnerId'],
};
