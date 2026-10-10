# sail follow-ups for keel v1.2.106

## S1 OAuth login honors `prompt`

keel redirects to the login page with `?return=…&prompt=login` (or `select_account`) when the person asks to use a different account on the consent page, or the client sends `prompt`. `AuthService.startHandoff` hands the current session off as soon as the page has a valid `return`, so the same account is granted again.

- With `prompt` present, do not hand off the live session: show the sign-in form (offer "sign out" of the current account), and hand off only after a fresh sign-in.
- `select_account` may list the signed-in account as one choice; `login` must always re-authenticate.

## S2 New-device step-up at sign-in

A sign-in response may be `{twoFactorRequired: true, twoFactorMethod: "email", loginToken}` (keel `stepup_new_device`). The code arrives by email and is posted to the same `/public/2fa/verify` with `loginToken`.

- `LoginResponse2FA` gains `twoFactorMethod?: 'email'`.
- The 2FA step says the code was emailed and hides "trust this device" and the backup-code path for `email`.
- Error codes: 403 `signin_network` (address outside the partner's sign-in networks), 503 `stepup_unavailable`.

## S3 Send the device cookie on every sign-in

keel recognizes a browser by the `keel_device` cookie set when a session starts. Requests without `withCredentials` neither store nor send it, so every such sign-in counts as a new device and emails a notice. Add `withCredentials: true` to the session-minting calls that lack it: `loginSocialUrl`, `otpVerifyUrl` and `confirmRegisterUrl`. Token refresh does not need it.

## S4 Sessions page

- `GET /api/user/sessions` → `[{id, userAgent, clientIp, signInMethod, createdAt, lastSeenAt, current}]`.
- `POST /api/user/sessions/revoke {id}` → 204; 404 `session_not_found`.
- Add `sessionListURL` and `sessionRevokeURL` to `rest_url.ts`, and a component beside `sail-trusted-devices` that lists sessions, marks the current one and signs out a selected one.

## S5 Generic actions (verify only)

`api_key/restrict` (parameter `allowed_cidrs`) and `partner_signin_network/replace` (parameter `cidrs`) are `P` table actions with parameters, rendered from metadata like `partner_identity_provider/configure`. Confirm that a string parameter can be left empty (empty clears the list) and that a 409 `signin_network_lockout` message is shown.
