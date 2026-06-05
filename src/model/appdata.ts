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

export interface AuthSummary {
    Obj: string;
    Act: string;
    Val: string;
    Reg: string;
}

export interface ApplicationData {
    MainMenu: ApplicationMenu[];
    Permissions: AuthorizationRolePermission[];
    ConstantCache: {[key: string]: {[key: string]: string}};
    TableCache: {[key: string]: {[key: string]: string}};
    TableDefinitions: {[key: string]: TableDefinition};
    Apis: {[key: string]: DictionaryPath};
    [key: string]: unknown;
}

export interface TableColumn {
  ColumnName:   string;
  PascalName:   string;
  Caption:      string;
  DataType:     string;
  InputType:    'text' | 'password' | 'number' | 'date' | 'datetime' | 'datetime-local' | 'textarea' | 'select' | 'checkbox';
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
  // Optional per-column UI overrides from keel's column_display_attribute.
  // Absent/0 means "no override" — fall back to the Size/InputType heuristics.
  Readonly?:     boolean;
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
	Latitude:             number;
	Longitude:            number;
	DomainURL:            string;
	PlanID:               string;
}

// PublicPlan — shape returned by GET /public/plans. Used on the registration
// page to render the plan picker and to drive `<sail-checkout-button>` flows.
export interface PublicPlan {
	id:          string;
	caption:     string;
	monthlyCost: number;
	annualCost:  number;
	// Stripe price ID (or provider-equivalent). Optional because keel only
	// populates it when a plan is wired to a billing provider; FREE plans and
	// not-yet-priced tiers leave it empty. Pass straight to
	// `<sail-checkout-button [priceId]>` / `BillingService.createCheckout({ priceId })`.
	priceId?:    string;
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
	status:      string;  // 'A' active, 'P' pending-payment, 'C' cancelled, ...
	begda:       string;
	endda?:      string;
	monthlyCost: number;
	currency:    string;
	autoRenew:   boolean;
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

// Result of PayoutService.startOnboarding(). url is opened in a webview /
// external browser; the provider posts back via webhook when activation
// lands.
export interface PayoutOnboardingSession {
	url:               string;
	externalAccountId: string;
	expiresAt:         string;
}

// Payload the bank-info form emits. Maps 1:1 to basis user_bank_info
// columns. The consumer decides where to POST it — typically a direct
// generic-CRUD insert against /api/v1/user_bank_info.
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
