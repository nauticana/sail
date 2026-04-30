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
// `contactType` is a frontend-only convenience field used to drive UI
// navigation (phone-confirm vs email-confirm). It is NOT sent to the
// backend — keel detects phone-vs-email from the `contact` value itself.
// `BaseAuthService.sendOtp` strips this field before posting, since keel
// rejects unknown JSON fields with 400.
export type OtpContactType = 'phone' | 'email';
export type OtpPurpose     = 'login' | 'register' | 'verify';

export interface OtpRequest {
  contact:        string;
  contactType?:   OtpContactType;  // frontend-only, stripped before POST
  purpose?:       OtpPurpose;
  defaultRegion?: string;          // ISO country hint for phone normalization
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
