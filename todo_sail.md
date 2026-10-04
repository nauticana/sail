# sail changes needed for keel v1.2.89

## S1 — OAuth sign-in through keel's session hand-off

**Gap.** `AuthService.completeLogin` hands a `?return=` login to the authorization
server by POSTing to `sessionCookieUrl`, an app-specific endpoint keel does not
ship. keel now ships the hand-off itself, so the app endpoint is unnecessary.

**Change.**
- Config: replace `sessionCookieUrl` with the AS base URL (e.g. `oauthServerUrl`),
  from app config, not hardcoded. Keep `allowedReturnHosts`.
- After login with a valid `?return=`: `POST {oauthServerUrl}/oauth/session/handoff`
  with the bearer JWT and body `{"return": <raw return value>}`, then
  `window.location.assign(data.redirect)` (a full navigation, not the router).
- The request is bearer-authenticated, so no `withCredentials` and no CSRF token.
  The AS sets its own HttpOnly cookie on redirect; sail never reads or writes it.
- 400 means keel rejected the return URL: show `sessionHandoffError` and never
  redirect elsewhere. 401 means sign in again, then retry.
- Remove `sessionCookieUrl` without a shim (breaking; note in the migration guide).

## S2 — Subscription changes need a grant

keel now answers 403 on `/api/billing/subscription/cancel`, `/change` and
`/api/billing/portal` unless the user holds `PARTNER_PLAN_SUBSCRIPTION`
`CANCEL` / `CHANGE` / `PORTAL` (seeded for `PARTNER_ADMIN`). The billing
components should surface a 403 as "not permitted", not as a provider failure.

## S3 — Agency delegation roles

keel adds a role set with per-role expiry on a client's delegation.
- `model/agency.ts`: add `AgencyRoleGrant { role: string; expiresAt?: string }`;
  `AgencyDelegation.roles: AgencyRoleGrant[]` (always present) and
  `AgencyClient.roles?: AgencyRoleGrant[]`.
- `rest_url.ts`: `agencyDelegationRolesURL: '/api/v1/agency/delegation/roles'`.
- `AgencyService.setDelegationRoles(roles: AgencyRoleGrant[], clientPartnerId = 0)`
  posting `{ clientPartnerId, roles }`; it replaces the whole set, and an empty
  list removes access without revoking.
- Role codes and captions come from the `agency_delegation_role` constant
  catalogue through backend metadata; do not hardcode `V`/`O`/`P`.
- Errors: 422 for an unknown, duplicate or blank role, more than 32 roles, or an
  expiry not in the future; 403 without `AGENCY_DELEGATION/SET_ROLE`.
