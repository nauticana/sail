// Auth / consent / OTP / social / push / re-auth types — mirror keel's port types
// (see keel/README.md and keel/handler/*).

// ── Canonical consent type labels (match keel's port.ConsentType*) ──
export const ConsentType = {
  PRIVACY_POLICY: 'privacy_policy',
  TERMS:          'terms',
  CROSS_BORDER:   'cross_border',
  VIDEO_OPT_IN:   'video_opt_in',
  VIDEO_SESSION:  'video_session',
  MARKETING:      'marketing',
} as const;
export type ConsentTypeValue = typeof ConsentType[keyof typeof ConsentType];

// Declarative config for an optional consent checkbox rendered by ConsentGate.
export interface ConsentOption {
  id:        string;    // ConsentType value, e.g. 'video_opt_in'
  label:     string;    // Checkbox label
  required?: boolean;   // If true, state.valid stays false until checked
  hint?:     string;    // Small explanatory text below the label
  linkUrl?:  string;    // Optional inline link in the label
  linkText?: string;
}

// Emitted by ConsentGateComponent on every change. Mirrors keel's
// port.SignupConsent.Consents map directly.
export interface ConsentState {
  consents:       Record<string, boolean>;
  policyVersion:  string;
  policyLanguage: string;
  valid:          boolean;
}

// Sent to the backend alongside OTP / social / register requests.
// Matches keel's user.SignupConsent.
export interface SignupConsent {
  policyType?:    string;  // e.g. 'default' | 'custom'
  policyVersion:  string;
  policyRegion?:  string;  // ISO country code
  policyLanguage: string;
  region?:        string;
  consents:       Record<string, boolean>;
}

// ── Phone / email OTP ──
// `contactType` selects the OTP delivery channel. As of keel v0.5.11
// the backend honors this field directly: 'phone' (default — `contact`
// is normalized to E.164 and OTP goes via SMS) or 'email' (`contact`
// is lowercased + trimmed and OTP goes via the keel MailClient).
// Older keel deployments ignore anything other than phone — pin the
// consumer's go.mod when this matters.
export type OtpContactType = 'phone' | 'email';
export type OtpPurpose     = 'login' | 'register' | 'verify';

export interface OtpRequest {
  contact:        string;
  contactType?:   OtpContactType;  // 'phone' (default) | 'email'
  purpose?:       OtpPurpose;
  defaultRegion?: string;          // ISO country hint for phone normalization
  // The OTHER contact the user supplied at signup, persisted on the
  // new user_account row even though it isn't being OTP-verified at
  // this step. When contactType='email', this is the user's phone;
  // when contactType='phone', this is the user's email. Optional —
  // omit for login flows (only registration creates the row).
  secondaryContact?: string;
  policyType?:    string;
  policyVersion?: string;
  policyRegion?:  string;
  policyLanguage?: string;
  region?:        string;
  consents?:      Record<string, boolean>;
}

// keel issues a 32-byte base64-URL opaque token bound to the user_id in
// the cache for ~5 minutes. Verify and Resend echo this back; an attacker
// guessing arbitrary user ids cannot reach Verify because the cache lookup
// fails. The login fall-through on unknown contacts also returns a token
// (resolving to user_id 0) so 200 responses don't leak which contacts are
// registered. Verify on a "fake" token returns the same generic 401 as a
// wrong code.
export interface OtpResponse {
  otpToken: string;
  // Seconds the client should wait before allowing a resend; mirrors
  // the server's --otp_ttl_seconds. Optional for back-compat with
  // older keel versions that didn't return it.
  resendCountdownSec?: number;
}

export interface OtpVerifyRequest {
  otpToken: string;
  code:     string;
}

export interface OtpVerifyResponse {
  token:      string;
  userId?:    number;
  partnerId?: number;
}

export interface OtpResendRequest {
  otpToken: string;
  purpose?: OtpPurpose;
}

// Current user's editable profile (GET profileURL). language is the locale.
export interface UserProfile {
  firstName:        string;
  lastName:         string;
  email:            string;
  phoneNumber:      string;
  language:         string;
  twoFactorEnabled?: boolean;
}

// ── Re-authentication credentials ──
// Required by Setup2FA, Disable2FA, DeleteAccount, LogoutEverywhere — server
// rejects with 401 if neither `password` nor `twoFactorCode` is supplied.
// Disable2FA additionally requires the current TOTP `code` alongside password.
export interface ReauthCredentials {
  password?:      string;
  twoFactorCode?: string;
}

// ── Social login (ID token flow) ──
export type SocialProvider = 'google' | 'apple';

export interface SocialLoginRequest {
  provider:        SocialProvider;
  token:           string;   // ID token from provider SDK
  policyType?:     string;
  policyVersion?:  string;
  policyRegion?:   string;
  policyLanguage?: string;
  region?:         string;
  consents?:       Record<string, boolean>;
}

export interface LoginResponseSocial {
  token:                   string;
  userId?:                 number;
  partnerId?:              number;
  isNewUser:               boolean;
  singleDeviceSession?:    boolean;
  previousDeviceRevoked?:  boolean;
}

// ── Push notification tokens ──
export type PushPlatform = 'I' | 'A' | 'W';  // iOS / Android / Web

export interface PushRegisterRequest {
  platform:      PushPlatform;
  token:         string;
  appVersion?:   string;
  deviceModel?:  string;
}
