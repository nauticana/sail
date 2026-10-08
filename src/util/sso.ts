import { RestURL } from '../service/rest_url';

/** Error codes keel's SSOHandler sends back to the return URL as `?error=`. */
export type SsoErrorCode =
  | 'sso_unavailable'
  | 'sso_failed'
  | 'mfa_required'
  | 'sso_email_not_allowed'
  | 'sso_no_account'
  | 'sso_other_partner'
  | 'sso_required'
  | 'account_unavailable'
  | 'identity_linked'
  | 'sso_test_mismatch'
  | 'domain_not_proven'
  | 'server_error';

/** Default wording; an app overrides entries through `SailGuiConfig.ssoErrorMessages`. */
export const SSO_ERROR_MESSAGES: Record<SsoErrorCode, string> = {
  sso_unavailable: 'Single sign-on is not available for this email address. Use another sign-in method.',
  sso_failed: 'The sign-in could not be completed. Please try again.',
  mfa_required: 'Your organization requires multi-factor authentication. Complete it at your organization\'s sign-in page and try again.',
  sso_email_not_allowed: 'This account is outside your organization\'s verified domains.',
  sso_no_account: 'You do not have an account yet. Ask your organization\'s administrator for access.',
  sso_other_partner: 'This account belongs to another organization.',
  sso_required: 'Your organization requires you to sign in with single sign-on.',
  account_unavailable: 'This account is locked or expired. Contact your administrator.',
  identity_linked: 'This account is already linked to a different identity at your organization\'s identity provider.',
  sso_test_mismatch: 'The identity provider signed in someone other than you. Sign in there as yourself and test again.',
  domain_not_proven: 'The identity provider did not prove your organization\'s domain.',
  server_error: 'Something went wrong. Please try again.',
};

/** The message for a returned code; an unknown code reads as `server_error`. */
export function ssoErrorMessage(code: string | null | undefined, overrides?: Partial<Record<SsoErrorCode, string>>): string {
  const key = (code && code in SSO_ERROR_MESSAGES ? code : 'server_error') as SsoErrorCode;
  return overrides?.[key] ?? SSO_ERROR_MESSAGES[key];
}

/** keel's `/public/sso/start` for an address, on the API host. */
export function ssoStartUrl(email: string): string {
  return RestURL.httpHost + RestURL.ssoStartURL + '?' + new URLSearchParams({ email: email.trim() }).toString();
}
