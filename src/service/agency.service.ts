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
} from '../model/agency';
import { BaseRestService } from './base_rest.service';
import { RestURL } from './rest_url';

/** Thin REST client for keel/agency. */
@Injectable({ providedIn: 'root' })
export class AgencyService extends BaseRestService {
  enroll(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(this.url(RestURL.agencyEnrollURL), {});
  }

  profile(): Observable<{ profile: AgencyProfile | null }> {
    return this.http.get<{ profile: AgencyProfile | null }>(this.url(RestURL.agencyProfileURL));
  }

  clients(): Observable<{ items: AgencyClient[]; activeClients: number }> {
    return this.http.get<{ items: AgencyClient[]; activeClients: number }>(this.url(RestURL.agencyClientsURL));
  }

  addClients(clients: AgencyClientInput[]): Observable<{ added: number }> {
    return this.http.post<{ added: number }>(this.url(RestURL.agencyClientsURL), { clients });
  }

  invite(invitationId: number): Observable<{ inviteLink: string }> {
    return this.http.post<{ inviteLink: string }>(this.url(RestURL.agencyInviteClientURL), { invitationId });
  }

  cancel(invitationId: number): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyCancelClientURL), { invitationId });
  }

  setBillingModel(clientPartnerId: number, billingModel: 'R' | 'W'): Observable<{ billingModel: string }> {
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

  setPayoutProfile(userBankInfoId: number): Observable<{ status: string }> {
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

  revokeDelegation(clientPartnerId = 0): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(this.url(RestURL.agencyRevokeDelegationURL), { clientPartnerId });
  }
}
