export interface AgencyProfile {
  agencyPartnerId: number;
  wholesaleAllowed: boolean;
  defaultCommissionRateBp?: number;
  approvedAt?: string;
  suspended: boolean;
}

export interface AgencyClientInput {
  name: string;
  email?: string;
  website?: string;
}

export interface AgencyClient {
  id: number;
  name: string;
  email?: string;
  website?: string;
  status: string;
  clientPartnerId?: number;
  acceptedBy?: number;
  invitedAt?: string;
  acceptedAt?: string;
  expired?: boolean;
  billingModel?: string;
}

export interface AgencyInvite {
  invitationId: number;
  agencyName: string;
  clientName: string;
  status: string;
  expired?: boolean;
}

export interface AgencyDelegation {
  id: number;
  clientPartnerId: number;
  clientName: string;
  agencyPartnerId: number;
  agencyName: string;
  billingModel?: string;
  grantedAt: string;
}

export interface AgencyEarningsBalance {
  currency: string;
  heldMinor: number;
  dueMinor: number;
  paidMinor: number;
}

export interface AgencyEarningEntry {
  id: number;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  currency: string;
  entryType: string;
  status: string;
  earnedAt: string;
}

export interface AgencyPayout {
  id: number;
  amountMinor: number;
  currency: string;
  status: string;
  cutoffAt: string;
  paidAt?: string;
}

export interface AgencyPayoutProfile {
  agencyPartnerId: number;
  userBankInfoId: number;
  countryCode: string;
  currency: string;
  provider: string;
  providerAccountId: string;
  status: string;
}

export interface AgencyPayoutDestination {
  userBankInfoId: number;
  countryCode: string;
  currency: string;
  provider: string;
  providerAccountId: string;
}

export interface AgencyPayoutProfileOptions {
  profile: AgencyPayoutProfile | null;
  destinations: AgencyPayoutDestination[];
}

export interface AgencyEarnings {
  balances: AgencyEarningsBalance[];
  entries: AgencyEarningEntry[];
  payouts: AgencyPayout[];
  payingClients: number;
}

export interface AgencyClientColumn {
  id: string;
  caption: string;
  value: (client: AgencyClient) => string;
}
