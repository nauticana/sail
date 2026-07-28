export const RestURL = {
  httpHost: '',
  api_prefix: '/api/',
  appdataURL: '/api/config/appdata',
  loginURL: '/public/login/local',
  loginGoogleURL: '/public/login/google',
  registerURL: '/public/register',
  chpassURL: '/public/login/chpass',
  confirmRegisterURL: '/public/confirm/register',
  plansURL: '/public/plans',
  confirmChpassURL: '/public/confirm/password',
  twoFactorSetupURL: '/api/user/2fa/setup',
  twoFactorVerifyURL: '/api/user/2fa/verify',          // authenticated — confirms setup
  twoFactorDisableURL: '/api/user/2fa/disable',
  twoFactorLoginVerifyURL: '/public/2fa/verify',        // public — login-time TOTP verify
  twoFactorBackupVerifyURL: '/public/2fa/backup-verify', // public — login-time backup verify
  trustedDeviceListURL: '/api/user/trusted-device/list',
  trustedDeviceRegisterURL: '/api/user/trusted-device/register',
  trustedDeviceRevokeURL: '/api/user/trusted-device/revoke',
  checkoutURL:       '/api/billing/checkout',
  subscriptionURL:   '/api/billing/subscription',
  cancelSubURL:      '/api/billing/subscription/cancel',
  changePlanURL:     '/api/billing/subscription/change',
  seatsURL:          '/api/billing/subscription/seats',
  invoicesURL:       '/api/billing/invoices',
  paymentMethodsURL: '/api/billing/payment-methods',
  portalURL:         '/api/billing/portal',
  usageURL:          '/api/billing/usage',
  // OTP / social / push / account-lifecycle endpoints
  otpSendURL:          '/public/otp/send',
  otpVerifyURL:        '/public/otp/verify',
  otpResendURL:        '/public/otp/resend',
  loginSocialURL:      '/public/login/social',
  logoutEverywhereURL: '/api/user/logout-everywhere',
  deleteAccountURL:    '/api/user/account',
  // Self-service profile (keel ProfileHandler). GET profileURL reads the
  // current profile; POST updates name/locale. Email/phone are verify-before-
  // apply (request → confirm). A consumer whose backend mounts these under a
  // different prefix overrides them via configureRestUrls.
  profileURL:             '/api/user/profile',
  profileEmailURL:        '/api/user/profile/email',
  profileEmailConfirmURL: '/api/user/profile/email/confirm',
  profilePhoneURL:        '/api/user/profile/phone',
  profilePhoneConfirmURL: '/api/user/profile/phone/confirm',
  pushRegisterURL:     '/api/push/register',
  pushRevokeURL:       '/api/push/revoke',
  // Payout — keel/payout endpoints. keel mounts PayoutHandler.Routes(prefix)
  // under the app's REST prefix; these defaults assume the conventional
  // '/api/v1'. Payout routes are not in the Apis dictionary, so the version
  // cannot be derived at runtime — apps mounting elsewhere MUST override
  // these via configureRestUrls.
  payoutOnboardStartURL: '/api/v1/payout/onboard/start',
  payoutReusableURL:     '/api/v1/payout/reusable',
  payoutReusableLinkURL: '/api/v1/payout/reusable/link',
  payoutStatusURL:       '/api/v1/payout/status',
  payoutBankReplaceURL:  '/api/v1/payout/bank/replace',
  payoutBeneficiaryURL:  '/api/v1/payout/beneficiary/register',
  // User payment methods — list/delete go through keel's generic REST
  // CRUD against the UserSpecific basis table; set-default is a
  // TableAction (basis table_action row), mounted at the conventional
  // URL POST /api/v1/user_payment_method/set_default.
  paymentMethodSetDefaultURL: '/api/v1/user_payment_method/set_default',
};

/** Call this at app startup to set the backend host URL */
export function configureRestUrls(httpHost: string, overrides?: Partial<typeof RestURL>) {
  RestURL.httpHost = httpHost;
  if (overrides) {
    Object.assign(RestURL, overrides);
  }
  // A trailing slash would make url() produce host//api/... while the
  // interceptor matchers look for host/api/... — normalize once here.
  if (RestURL.httpHost.endsWith('/')) {
    RestURL.httpHost = RestURL.httpHost.slice(0, -1);
  }
}

/** Configured host without a trailing slash, so `host + '/api/'` never yields `//api/`. */
function normalizedHost(): string {
  const host = RestURL.httpHost;
  return host.endsWith('/') ? host.slice(0, -1) : host;
}

/**
 * True when `url` targets the configured keel backend's authenticated `/api/`
 * surface. Used to scope the JWT interceptor so the token is never attached to
 * a third-party origin that merely happens to contain `/api/` in its path.
 */
export function isKeelApiUrl(url: string): boolean {
  const host = normalizedHost();
  return host ? url.startsWith(host + '/api/') : url.startsWith('/api/');
}

/**
 * True when `url` targets the keel backend's API surface (`/api/` or
 * `/public/`). Used to scope the response interceptor's envelope-unwrapping so
 * third-party responses — and non-API fetches from the backend host (assets,
 * health checks) — pass through untouched.
 */
export function isKeelUrl(url: string): boolean {
  const host = normalizedHost();
  if (host) return url.startsWith(host + '/api/') || url.startsWith(host + '/public/');
  return url.startsWith('/api/') || url.startsWith('/public/');
}
