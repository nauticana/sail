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
  invoicesURL:       '/api/billing/invoices',
  paymentMethodsURL: '/api/billing/payment-methods',
  // OTP / social / push / account-lifecycle endpoints
  otpSendURL:          '/public/otp/send',
  otpVerifyURL:        '/public/otp/verify',
  otpResendURL:        '/public/otp/resend',
  loginSocialURL:      '/public/login/social',
  logoutEverywhereURL: '/api/user/logout-everywhere',
  deleteAccountURL:    '/api/user/account',
  pushRegisterURL:     '/api/push/register',
  pushRevokeURL:       '/api/push/revoke',
  // Payout — keel/payout endpoints (B5b + A3 interface).
  payoutOnboardStartURL: '/api/v1/payout/onboard/start',
  payoutReusableURL:     '/api/v1/payout/reusable',
  payoutReusableLinkURL: '/api/v1/payout/reusable/link',
  payoutStatusURL:       '/api/v1/payout/status',
};

/** Call this at app startup to set the backend host URL */
export function configureRestUrls(httpHost: string, overrides?: Partial<typeof RestURL>) {
  RestURL.httpHost = httpHost;
  if (overrides) {
    Object.assign(RestURL, overrides);
  }
}
