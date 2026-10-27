import { AbstractControlOptions } from '@angular/forms';
import { ApplicationMenu, AuthorizationRolePermission } from './common';
import { Int64 } from '../util/integer';

export const DataType = {
  STRING:    'string',
  INTEGER:   'integer',
  /** int8: values are `Int64` strings. */
  BIGINT:    'bigint',
  FLOAT:     'float',
  BOOLEAN:   'boolean',
  TIMESTAMP: 'timestamp',
} as const;

export interface LoginRequest {
  Username: string;
  Password: string;
}

export interface LoginResponse {
  token: string;
}

export interface ApplicationData {
    MainMenu: ApplicationMenu[];
    Permissions: AuthorizationRolePermission[];
    ConstantCache: {[key: string]: {[key: string]: string}};
    TableCache: {[key: string]: {[key: string]: string}};
    TableDefinitions: {[key: string]: TableDefinition};
    Apis: {[key: string]: DictionaryPath};
    /** keel emits Reports as map[string]*RestReport — a JSON object keyed by report id. */
    Reports?: {[key: string]: RestReport};
    [key: string]: unknown;
}

export interface TableColumn {
  ColumnName:   string;
  PascalName:   string;
  Caption:      string;
  DataType:     string;
  InputType:    'text' | 'password' | 'number' | 'date' | 'time' | 'datetime' | 'datetime-local' | 'textarea' | 'select' | 'checkbox';
  Size:         number;
  Scale:        number;
  Step:         string;
  Order:        number;
  Required:     boolean;
  IsKey:        boolean;
  SequenceName: string;
  LookupDomain: string;
  LookupTable:  string;
  LookupStyle:  string;
  HasDefault:   boolean;
  DefaultValue: string;
  Validators?:  AbstractControlOptions['validators'];
  // Optional per-column UI/CRUD overrides from keel's column_display_attribute.
  // DisplayMode: 'R' read-only, 'H' hidden, 'D' default-seeded, 'I' insert-only;
  // absent/'' = editable default. Absent width/rows = fall back to heuristics.
  DisplayMode?:  string;
  DisplayWidth?: number;
  DisplayRows?:  number;
  /** Marks a minor-units money column: a sibling currency column, or parent tables up to it joined with dots. */
  CurrencyPath?: string;
}

// One custom button registered against a table via the basis
// table_action seed. Auth gating uses the existing
// authorization_role_permission path against (authorityObject,
// authorityCheck, low_limit=tableName) — see canExecute() in
// BaseAuthService.
//
// recordSpecific=true  → button renders next to per-row edit/delete.
// recordSpecific=false → button renders next to the "New Record" toolbar.
//
// `method` is the URL POST target the click should hit (resolved by
// keel from table_name + action_name + optional method_name override).
export interface TableAction {
  action:           string;   // lowercase action_name
  caption:          string;
  method:           string;   // resolved URL path (POST target)
  icon?:            string;   // Material icon name; falsy → label-only
  recordSpecific:   boolean;
  displayOrder?:    number;
  confirmMessage?:  string;
  authorityObject:  string;   // uppercased table_name — for canExecute()
  authorityCheck:   string;   // uppercased action_name — for canExecute()
  kind?:            'P' | 'R' | 'V'; // constant_value codes: P post (default) / R redirect (follow {url}) / V reveal (show returned secret once)
  parameters?:      TableActionParameter[];
}

/** A value collected in a dialog before the action posts; merged into the body beside the record key. */
export interface TableActionParameter {
  name:         string;
  caption:      string;
  dataType:     string;
  required:     boolean;
  lookupTable?: string;   // offer this table's cached rows as choices
}

export interface ForeignKey {
  ParentTable:    string;
  ChildTable:     string;
  PascalName:     string;
  ConstraintName: string;
  LookupStyle:    string;
  Columns:        TableColumn[];
  /** The parent columns `Columns` reference, by index: a unique key, not necessarily the primary key. */
  ParentColumns:  TableColumn[];
}

export interface TableDefinition {
  TableName:             string;
  PascalName:            string;
  PartnerSpecific:       boolean;
  Keys:                  TableColumn[];
  Columns:               TableColumn[];
  Actions:               TableAction[];
  LookupStyle:           string;
  LookupColumns:         TableColumn[];
  Details:               string[];
  Parents:               ForeignKey[];
  Children:              ForeignKey[];
}

export interface DictionaryPath {
  RestAPI:     string;
  Version:     string;
  Table:       TableDefinition;
  Caption:     string;
  PascalName:  string;
  PathType:    string;
  ParentKeys:   TableColumn[];
  ChildKeys:    TableColumn[];
  Children:     DictionaryPath[];
}

export interface ReportParam {
  Name:       string;
  DataType:   string;
  /**
   * When set, the parameter input renders as a dropdown populated from
   * the matching constant_value rows (Pass/Fail/etc.) instead of a free-text
   * input. Empty string / undefined means no domain — render a plain input
   * typed by DataType.
   */
  ConstantId?: string;
}

export interface RestReport {
  Id:          string;
  Version:     string;
  QueryName:   string;
  // Long-form text rendered as the report page header. The short nav-rail
  // label is application_menu_item.caption — no duplication here.
  Description: string;
  Params:      ReportParam[];
}

// 2FA / Trusted device types

/** POST /public/token/refresh response; every login response carries the same pair. */
export interface TokenPair {
  token:        string;
  refreshToken: string;
  userId?:      Int64;
  partnerId?:   Int64;
}

export interface LoginResponse2FA {
  token: string;
  /** keel v1.2.57+: rotated at /public/token/refresh when the JWT expires. */
  refreshToken?: string;
  twoFactorRequired: boolean;
  loginToken?: string;
  /** 'email': a new-device step-up code was emailed; absent: the authenticator app. */
  twoFactorMethod?: 'email';
  userId?: Int64;
  partnerId?: Int64;
  // Populated for users with the single-device session policy enabled.
  // UI surfaces an info banner / can enforce "signed out elsewhere" notices.
  singleDeviceSession?: boolean;
  previousDeviceRevoked?: boolean;
}

export interface TwoFactorSetupResponse {
  secret:      string;
  qrUri:       string;
  backupCodes: string[];
}

export interface TwoFactorVerifyRequest {
  code:             string;
  loginToken?:      string;
  trustDevice?:     boolean;
  deviceName?:      string;
}

export interface TwoFactorVerifyResponse {
  valid: boolean;
  token?: string;
  refreshToken?: string;
}

export interface TrustedDevice {
  id:         Int64;
  name:       string;
  last_used_at: string;
  created_at:   string;
}

export interface ActiveSession {
  id:           Int64;
  userAgent:    string;
  clientIp:     string;
  signInMethod: string;
  createdAt:    string;
  lastSeenAt:   string;
  current:      boolean;
}

// Mirrors keel `user.AccountRegistration`.
export interface AccountRegistration {
	firstName: string;
	lastName:  string;
	userName:  string;
	email:     string;
	password:  string;
}

// Mirrors keel `user.PartnerSetup`. `extra` carries the application's own fields.
export interface PartnerSetup<TExtra = unknown> {
	partnerCaption: string;
	address:        string;
	city:           string;
	state:          string;
	zipcode:        string;
	country:        string;
	phone:          string;
	latitude?:      number;
	longitude?:     number;
	domainUrl:      string;
	planId:         string;
	// Chosen offer (PERIOD_TYPE codes); none selects the plan's cheapest.
	billingCycle?:  string;
	termType?:      string;
	termCount?:     number;
	extra?:         TExtra;
}

// Mirrors keel `user.PartnerRegistration`. Without partner fields only the
// account is created and the partner follows through `createPartner`.
// `challengeToken` comes from `<sail-human-challenge>` when keel runs a verifier.
export type PartnerRegistration<TExtra = unknown> = AccountRegistration & Partial<PartnerSetup<TExtra>> & { challengeToken?: string };

// Mirrors keel `user.PartnerCreated`. `paymentRequired` without a `paymentUrl`
// means the application's billing page opens the checkout.
export interface PartnerCreated {
	partnerId:       Int64;
	planId:          string;
	paymentRequired: boolean;
	paymentUrl?:     string;
}

// One purchasable offer for a plan: a (billing cycle × commitment term) row of
// keel's `subscription_plan_price` table. Mirrors keel `billing.PlanPrice`.
export interface PlanPrice {
	billingCycle: string;   // PERIOD_TYPE code (D/W/M/A) — how often charged
	termCount:    number;   // commitment length, in termType units
	termType:     string;   // PERIOD_TYPE code — commitment/pricing unit
	amountMinor:  Int64;    // price per termType unit, in minor units
	currency:     string;   // ISO 4217
	exponent:     number;   // minor-unit decimals from keel's currency table
	// Provider price id (Stripe Price). Empty for free/unpriced offers; pass to
	// `<sail-checkout-button [priceId]>` / `createCheckout({ priceId })`.
	priceId?:     string;
}

// Mirrors keel `billing.Plan` from GET /public/plans.
export interface PublicPlan {
	id:          string;
	caption:     string;
	currency:    string;
	// Purchasable offers; derive a display price with `fromPriceLabel(plan.prices)`
	// and feed the chosen offer's `priceId` to `<sail-checkout-button>`.
	prices:      PlanPrice[] | null;
	// keel `subscription_plan.activation_mode` ('P' paid, 'F' free, 'T' trial); drives the picker CTA.
	activationMode: string;
	// Length of the free trial in days when `activationMode === 'T'`.
	trialDays:      number;
}

// ConfirmRegisterResponse — shape returned by POST /public/register/confirm:
// the new session's tokens, plus the partner result when the registration had one.
export interface ConfirmRegisterResponse extends TokenPair {
	status:           string;
	planId?:          string;
	paymentRequired?: boolean;
	paymentUrl?:      string;
}

// ── Billing / Payment types ──
// See keel/SHARED_PAYMENT.md for the backend contract.

export interface PaymentMethod {
	id:         string;
	provider:   string;  // 'stripe' | 'lemonsqueezy' | ...
	methodType: string;  // 'card' | 'bank' | ...
	last4?:     string;
	isDefault:  boolean;
}

// CreateCheckout is JWT-gated and validates `priceId`, `successUrl`,
// `cancelUrl` against server-side allowlists. Empty allowlists cause every
// checkout to be rejected with 400.
export type CheckoutMode = 'subscription' | 'payment' | 'setup';

export interface CheckoutRequest {
	mode?:       CheckoutMode;        // default 'subscription'
	// Required for 'subscription' / 'payment'; must be empty for 'setup'.
	// Pass the chosen `PlanPrice.priceId` straight through.
	priceId?:    string;
	quantity?:   number;
	email?:      string;
	// ISO 4217. A setup session with neither this nor paymentMethodTypes offers cards.
	currency?:   string;
	// Provider method types, such as 'card' or 'sepa_debit'; keel answers 400 for an unknown one.
	paymentMethodTypes?: readonly string[];
	// Hostname must match keel's `AllowedRedirectHosts`. Default port matching
	// is hostname-only; include the port (e.g. `host:8443`) only if the
	// operator deliberately wants port-strict matching.
	successUrl:  string;
	cancelUrl:   string;
	// Provider metadata — values must be strings. keel stringifies any
	// numeric / boolean values in its server-side metadata adapter, so when
	// reading back metadata in webhook handlers, expect the stringified form
	// (e.g. `partner_id` arrives as `"42"`, not `42`).
	metadata?:   { [key: string]: string };
}

/** POST /api/billing/setup-intent — open the provider's payment sheet with these. */
export interface SetupIntentResponse {
  setupIntentId: string;
  clientSecret:  string;
  customerId:    string;
  ephemeralKey:  string;
}

export interface CheckoutResponse {
	checkoutUrl: string;
}

/** Response of BillingService.createPortalSession — the provider customer-portal URL. */
export interface PortalResponse {
	portalUrl: string;
}

/** One resource's current-period usage vs its plan limit (matches keel UsageItem). */
export interface UsageMeter {
	resource: string;
	caption:  string;
	used:     Int64;
	limit:    Int64;
}

// Normalized outcome of an off-session charge — the camelCase JSON shape an app
// returns from its own charge endpoint, mirroring keel `payment.ChargeResult`.
// 'requires_action' means the rider must complete an SCA / 3DS confirmation
// (drive it with `<sail-sca-confirm>`).
// 'authentication_required' is an off-session refusal: no next_action to run —
// re-confirm the same intent on-session with paymentMethodId.
export type ChargeStatus = 'succeeded' | 'requires_action' | 'authentication_required' | 'failed';

export interface ChargeResult {
	status:            ChargeStatus;
	providerChargeId?: string;   // PaymentIntent / charge id (pi_xxx)
	// Provider client secret for inline confirmation or on-session re-confirmation.
	clientSecret?:     string;
	// Provider-hosted redirect URL when one exists (often empty for off-session
	// 3DS). When present it's the simplest, provider-agnostic confirmation path.
	actionUrl?:        string;
	// The refused stored method, to re-confirm with when
	// status === 'authentication_required'. Mirrors keel ChargeResult.PaymentMethodID.
	paymentMethodId?:  string;
	error?:            string;   // decline / error message when status === 'failed'
}

// REST list endpoints return paginated wrappers. `BackendService.list<T>()`
// unwraps to the array; use `listPaginated<T>()` to get the metadata.
export interface PaginatedList<T> {
	items:  T[];
	limit:  number;
	offset: Int64;
	total:  Int64;
}

/** Typed controls for keel REST list pagination and ordering. */
export interface PageRequest {
	limit?:   number;
	offset?:  number;
	orderBy?: string;
}

// Mirrors keel `billing.Subscription`; amounts are minor units at `exponent`.
export interface Subscription {
	planId:           string;
	caption?:         string;  // plan display name
	status:           string;  // 'A' active, 'P' pending-payment, 'C' cancelled, 'T' trialing, 'X' past-due — caption via subscription_status
	begda:            string;
	endda?:           string;
	installmentMinor: Int64;
	currency:         string;
	exponent:         number;
	autoRenew:        boolean;
	// PERIOD_TYPE code (D/W/M/A) the sub is charged on, copied from the chosen offer.
	billingCycle?:    string;
	// ISO timestamp the trial ends; empty/absent when not trialing. Drives `<sail-trial-banner>`.
	trialEnd?:        string;
	// Seat quantity on the active/trial sub; absent for non-seat plans. Drives `<sail-seat-selector>`.
	seats?:           number;
	// False when the provider holds no subscription or customer: hide provider actions (portal, cancel, plan change).
	providerManaged:  boolean;
	// The plan that starts at scheduledAt, when this one ends; absent when nothing follows.
	scheduledPlanId?: string;
	scheduledAt?:     string;
}

// The offer a plan change moves to; a `PlanPrice` fits. Omitted, keel keeps the current terms.
export type PlanOffer = Pick<PlanPrice, 'billingCycle' | 'termType' | 'termCount'>;

// keel's plan-change outcome: applied now, or at the period end.
export interface PlanChangeResult {
	status: 'changed' | 'scheduled';
}

// A live-counted resource the partner holds more of than the target plan allows (keel `QuotaOverage`).
export interface PlanOverage {
	resource: string;
	caption:  string;
	count:    Int64;
	limit:    Int64;
}

// Mirrors keel `billing.Invoice`; `status` is keel's one-character invoice status code.
export interface Invoice {
	id:         string;
	number:     string;
	status:     string;
	totalMinor: Int64;
	currency:   string;
	exponent:   number;
	issuedAt:   string;
	paidAt?:    string;
}

// ── Payout types ──
// See keel/payout for the backend contract. user_bank_info is owned by
// basis; these types mirror keel/payout's ReusableAccount and
// StartOnboardingResult one-to-one.

// One provider account the user already has on a different partner.
// PayoutService.listReusable() returns these so multi-partner users can
// pick an existing account instead of redoing KYC.
export interface ReusableAccount {
	partnerId:         Int64;
	partnerCaption:    string;
	provider:          string;  // 'AW' Airwallex, 'SC' Stripe Connect, 'WI' Wise
	providerAccountId: string;
	countryCode:       string;  // ISO 3166-1 alpha-2
	currency:          string;  // ISO 4217
	onboardedAt:       string;
}

// Result of PayoutService.startOnboarding(). A non-empty url is opened in a
// webview / external browser. Some providers have no hosted flow (for example,
// Wise email recipients); in that case url and expiresAt are empty and
// PayoutProviderOnboardingComponent emits `pending` while confirmation
// continues asynchronously.
export interface PayoutOnboardingSession {
	url:               string;
	externalAccountId: string;
	expiresAt:         string;
}

// Application-layer payload emitted by the bank-info form. It is not a
// generic-CRUD row: taxId must be sealed into basis.user_bank_info's
// tax_id_encrypted column. First-time setup goes through the consuming app's
// registration service; changes use PayoutService.replaceBankInfo so keel can
// atomically supersede the active destination version.
export interface BankInfoFormValue {
	countryCode:       string;
	currency:          string;
	accountHolderName: string;
	billingAddress:    string;
	taxIdType:         string;  // keel `tax_id_type` code
	taxId:             string;
	provider:          string;
	providerAgreement: boolean;
}

// ── User payment methods ──
// Consumer-side saved cards/wallets. Mirrors basis user_payment_method
// one-to-one. Distinct from PaymentMethod (partner-scoped SaaS billing
// card).
//
// PascalCase fields match keel's generic REST CRUD response shape —
// list and delete go through that path (the table is UserSpecific so
// the auto-filter scopes reads + owner-locks DELETE). Only set-default
// has a custom endpoint because it needs atomic multi-row UPDATE.

export interface UserPaymentMethod {
	Id:           Int64;
	UserId?:      Int64;
	MethodType:   string;   // matches basis constant_header 'payment_method_type' — card / bank / wallet / apple_pay / google_pay
	Provider:     string;   // 'stripe', ...
	LastFour?:    string;
	Brand?:       string;
	ExpiryMonth?: number;
	ExpiryYear?:  number;
	Currency:     string;
	IsDefault:    boolean;
	CreatedAt:    string;
}
