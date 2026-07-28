import { AbstractControlOptions } from '@angular/forms';
import { ApplicationMenu, AuthorizationRolePermission } from './common';

export const DataType = {
  STRING:    'string',
  INTEGER:   'integer',
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
}

export interface ForeignKey {
  ParentTable:    string;
  ChildTable:     string;
  PascalName:     string;
  ConstraintName: string;
  LookupStyle:    string;
  Columns:        TableColumn[];
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

export interface LoginResponse2FA {
  token: string;
  twoFactorRequired: boolean;
  loginToken?: string;
  userId?: number;
  partnerId?: number;
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
}

export interface TrustedDevice {
  id:         number;
  name:       string;
  last_used_at: string;
  created_at:   string;
}

export interface PartnerRegistration {
	FirstName:            string;
	LastName:             string;
	UserName:             string;
	Email:                string;
	Password:             string;
	PartnerCaption:       string;
	Address:              string;
	City:                 string;
	State:                string;
	Zipcode:              string;
	Country:              string;
	Phone:                string;
	// null when geocoding is disabled or the address wasn't verified.
	Latitude:             number | null;
	Longitude:            number | null;
	DomainURL:            string;
	PlanID:               string;
}

// One purchasable offer for a plan — a (billing cycle × commitment term) row of
// keel's `subscription_plan_price` table (v1.0.5). A plan sells several; the
// customer picks one at checkout via `<sail-price-selector>`. Mirrors keel
// `billing.PlanPrice`.
export interface PlanPrice {
	billingCycle: string;   // PERIOD_TYPE code (D/W/M/A) — how often charged
	termCount:    number;   // commitment length, in termType units
	termType:     string;   // PERIOD_TYPE code — commitment/pricing unit
	amountMinor:  number;   // price per termType unit, in minor units (cents)
	amount:       number;   // same amount in major units (currency-exponent applied)
	currency:     string;   // ISO 4217
	// Provider price id (Stripe Price). Empty for free/unpriced offers; pass to
	// `<sail-checkout-button [priceId]>` / `createCheckout({ priceId })`.
	priceId?:     string;
}

// PublicPlan — shape returned by GET /public/plans. Used on the registration
// page to render the plan picker and to drive `<sail-checkout-button>` flows.
export interface PublicPlan {
	id:          string;
	caption:     string;
	// NOTE: keel v1.0.7 REMOVED the flat `monthlyCost`/`annualCost` from the plan
	// JSON (both `/public/plans` and the billing catalog). Price lives per-offer
	// in `prices[]`; derive a display price with `fromPriceLabel(plan.prices)`.
	// Purchasable offers (keel v1.0.5 `subscription_plan_price`, nested under the
	// plan). The source of truth for checkout — feed a chosen offer's `priceId`
	// to `<sail-checkout-button>`. Returned by `/public/plans` as of keel v1.0.6
	// (so `<sail-price-selector>` works on the registration page too); absent on
	// pre-v1.0.6 backends.
	prices?:     PlanPrice[];
	// @deprecated keel v1.0.5 moved per-offer prices into `prices[]`
	// (`subscription_plan.provider_price_id` was dropped). Use
	// `prices?.[…].priceId`. Kept optional for pre-v1.0.5 backends.
	priceId?:    string;
	// keel `subscription_plan.activation_mode` (SUBSCRIPTION_ACTIVATION_MODE
	// dictionary, single char — e.g. 'P' paid, 'F' free, 'T' trial). Drives the
	// picker CTA copy ("Start trial" / "Subscribe" / …). Optional — pre-v1.0.3
	// backends omit it.
	activationMode?: string;
	// Length of the free trial in days when `activationMode === 'T'`.
	trialDays?:      number;
}

// ConfirmRegisterResponse — shape returned by POST /public/confirm/register.
// When paymentRequired is true the UI should redirect the user to paymentUrl
// before letting them log in.
export interface ConfirmRegisterResponse {
	status:          string;
	partnerId:       number;
	planId:          string;
	paymentRequired: boolean;
	paymentUrl?:     string;
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
	// Pass `PublicPlan.priceId` straight through.
	priceId?:    string;
	quantity?:   number;
	email?:      string;
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
	used:     number;
	limit:    number;
}

// Normalized outcome of an off-session charge — the camelCase JSON shape an app
// returns from its own charge endpoint, mirroring keel `payment.ChargeResult`.
// 'requires_action' means the rider must complete an SCA / 3DS confirmation
// (drive it with `<sail-sca-confirm>`).
export type ChargeStatus = 'succeeded' | 'requires_action' | 'failed';

export interface ChargeResult {
	status:            ChargeStatus;
	providerChargeId?: string;   // PaymentIntent / charge id (pi_xxx)
	// Provider client secret — present when status === 'requires_action' and the
	// SCA challenge must be confirmed inline (provider SDK). Mirrors keel
	// ChargeResult.ClientSecret.
	clientSecret?:     string;
	// Provider-hosted redirect URL when one exists (often empty for off-session
	// 3DS). When present it's the simplest, provider-agnostic confirmation path.
	actionUrl?:        string;
	error?:            string;   // decline / error message when status === 'failed'
}

// REST list endpoints return paginated wrappers. `BackendService.list<T>()`
// unwraps to the array; use `listPaginated<T>()` to get the metadata.
export interface PaginatedList<T> {
	items:  T[];
	limit:  number;
	offset: number;
	total:  number;
}

export interface Subscription {
	planId:      string;
	status:      string;  // 'A' active, 'P' pending-payment, 'C' cancelled, 'T' trialing, 'X' past-due — caption via SUBSCRIPTION_STATUS dict
	begda:       string;
	endda?:      string;
	monthlyCost: number;
	currency:    string;
	autoRenew:   boolean;
	// PERIOD_TYPE code (D/W/M/A) the sub is charged on, copied from the chosen
	// offer (keel `billing_cycle`); absent on pre-v1.0.5 backends.
	billingCycle?: string;
	// ISO timestamp the trial ends (keel `trial_end`); empty/absent when not
	// trialing. Drives `<sail-trial-banner>`.
	trialEnd?:   string;
	// Seat quantity on the active/trial sub (keel `seats`); absent for
	// non-seat plans. Drives `<sail-seat-selector>`.
	seats?:      number;
}

export interface Invoice {
	id:       string;
	number:   string;
	status:   string;  // 'paid' | 'open' | 'void' | ...
	total:    number;
	currency: string;
	issuedAt: string;
	paidAt?:  string;
}

// ── Payout types ──
// See keel/payout for the backend contract. user_bank_info is owned by
// basis; these types mirror keel/payout's ReusableAccount and
// StartOnboardingResult one-to-one.

// One provider account the user already has on a different partner.
// PayoutService.listReusable() returns these so multi-partner users can
// pick an existing account instead of redoing KYC.
export interface ReusableAccount {
	partnerId:         number;
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
	taxIdType:         string;  // 'S' SIN, 'N' SSN, 'E' EIN, 'V' VAT, 'O' other
	taxId:             string;
	provider:          string;
	providerAgreement: boolean;
}

// CountryProfile drives the country dropdown in the bank-info form.
// Each profile bundles ISO codes + tax-id labelling so the form's
// hint/placeholder text follows the country selection.
export interface CountryProfile {
	code:             string;  // ISO 3166-1 alpha-2
	label:            string;
	currency:         string;  // ISO 4217
	taxIdType:        string;  // matches basis constant_header 'tax_id_type'
	taxIdLabel:       string;
	taxIdPlaceholder: string;
	taxIdHint:        string;
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
	Id:           number;
	UserId?:      number;
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
