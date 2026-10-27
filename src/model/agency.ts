import { Int64 } from '../util/integer';

export interface AgencyProfile {
  agencyPartnerId: Int64;
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
  id: Int64;
  name: string;
  email?: string;
  website?: string;
  status: string;
  clientPartnerId?: Int64;
  acceptedBy?: Int64;
  invitedAt?: string;
  acceptedAt?: string;
  expired?: boolean;
  billingModel?: string;
  roles?: AgencyRoleGrant[];
}

export interface AgencyInvite {
  invitationId: Int64;
  agencyName: string;
  clientName: string;
  status: string;
  expired?: boolean;
}

export interface AgencyDelegation {
  id: Int64;
  clientPartnerId: Int64;
  clientName: string;
  agencyPartnerId: Int64;
  agencyName: string;
  billingModel?: string;
  grantedAt: string;
  roles: AgencyRoleGrant[];
}

/** One `agency_delegation_role` code a client grants its agency; no expiresAt is open-ended. */
export interface AgencyRoleGrant {
  role: string;
  expiresAt?: string;
}

export interface AgencyEarningsBalance {
  currency: string;
  heldMinor: Int64;
  dueMinor: Int64;
  paidMinor: Int64;
}

export interface AgencyEarningEntry {
  id: Int64;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  amountMinor: Int64;
  currency: string;
  entryType: string;
  status: string;
  earnedAt: string;
}

export interface AgencyPayout {
  id: Int64;
  amountMinor: Int64;
  currency: string;
  status: string;
  cutoffAt: string;
  paidAt?: string;
}

export interface AgencyPayoutProfile {
  agencyPartnerId: Int64;
  userBankInfoId: Int64;
  countryCode: string;
  currency: string;
  provider: string;
  providerAccountId: string;
  status: string;
}

export interface AgencyPayoutDestination {
  userBankInfoId: Int64;
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
