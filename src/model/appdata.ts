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
}

export interface TableAction {
  action:         string;
  caption:        string;
  method:         string;
  enable:         string;
  authorityCheck: string;
  recordSpecific: string;
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
  Name:     string;
  DataType: string;
}

export interface RestReport {
  Id:        string;
  Version:   string;
  QueryName: string;
  Params:    ReportParam[];
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
  deviceFingerprint?: string;
  deviceName?:      string;
}

export interface TwoFactorVerifyResponse {
  valid: boolean;
  token?: string;
}

export interface TrustedDevice {
  id:         number;
  name:       string;
  fingerprint: string;
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
// page to render the plan picker and to drive `<app-checkout-button>` flows.
export interface PublicPlan {
	id:          string;
	caption:     string;
	monthlyCost: number;
	annualCost:  number;
	// Stripe price ID (or provider-equivalent). Optional because keel only
	// populates it when a plan is wired to a billing provider; FREE plans and
	// not-yet-priced tiers leave it empty. Pass straight to
	// `<app-checkout-button [priceId]>` / `BillingService.createCheckout({ priceId })`.
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
