import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AgencyClient,
  AgencyClientInput,
  AgencyDelegation,
  AgencyEarnings,
  AgencyInvite,
  AgencyPayoutProfileOptions,
  AgencyProfile,
  AgencyRoleGrant,
} from '../model/agency';
import { BaseRestService } from './base_rest.service';
import { RestURL } from './rest_url';
import { Int64 } from '../util/integer';

/** Thin REST client for keel/agency. */
@Injectable({ providedIn: 'root' })
export class AgencyService extends BaseRestService {
  enroll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.agencyEnrollURL), {});
  }

  profile(): Observable<{ profile: AgencyProfile | null }> {
    return this.http.get<{ profile: AgencyProfile | null }>(this.url(RestURL.agencyProfileURL));
  }

  clients(): Observable<{ items: AgencyClient[]; activeClients: Int64 }> {
    return this.http.get<{ items: AgencyClient[]; activeClients: Int64 }>(this.url(RestURL.agencyClientsURL));
  }

  addClients(clients: AgencyClientInput[]): Observable<{ added: number }> {
    return this.http.post<{ added: number }>(this.url(RestURL.agencyClientsURL), { clients });
  }

  invite(invitationId: Int64): Observable<{ inviteLink: string }> {
    return this.http.post<{ inviteLink: string }>(this.url(RestURL.agencyInviteClientURL), { invitationId });
  }

  cancel(invitationId: Int64): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyCancelClientURL), { invitationId });
  }

  setBillingModel(clientPartnerId: Int64, billingModel: 'R' | 'W'): Observable<{ billingModel: string }> {
    return this.http.post<{ billingModel: string }>(this.url(RestURL.agencyBillingModelURL), {
      clientPartnerId,
      billingModel,
    });
  }

  earnings(): Observable<AgencyEarnings> {
    return this.http.get<AgencyEarnings>(this.url(RestURL.agencyEarningsURL));
  }

  payoutProfile(): Observable<AgencyPayoutProfileOptions> {
    return this.http.get<AgencyPayoutProfileOptions>(this.url(RestURL.agencyPayoutProfileURL));
  }

  setPayoutProfile(userBankInfoId: Int64): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyPayoutProfileURL), { userBankInfoId });
  }

  inviteInfo(token: string): Observable<AgencyInvite> {
    return this.http.get<AgencyInvite>(this.url(RestURL.agencyInviteInfoURL), { params: { token } });
  }

  accept(token: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyAcceptInviteURL), { token });
  }

  delegation(): Observable<{ delegation: AgencyDelegation | null }> {
    return this.http.get<{ delegation: AgencyDelegation | null }>(this.url(RestURL.agencyDelegationURL));
  }

  /** Only the delegated agency revokes; a client removes its agency's access with `setDelegationRoles([])`. */
  revokeDelegation(clientPartnerId: Int64): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyRevokeDelegationURL), { clientPartnerId });
  }

  /** Replace the whole role set the client grants its agency; an empty list
   *  removes access without revoking the delegation. Omit the client to act for the session partner. */
  setDelegationRoles(roles: AgencyRoleGrant[], clientPartnerId?: Int64): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyDelegationRolesURL), { clientPartnerId, roles });
  }
}
