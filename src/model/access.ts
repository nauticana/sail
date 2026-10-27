import { Int64 } from '../util/integer';

/** A row of keel's `api_key` table as generic REST returns it; the hash never leaves keel. */
export interface ApiKey {
  Id:            Int64;
  KeyName:       string;
  KeyPrefix:     string;
  Scopes:        string;   // CSV
  IsActive:      boolean;
  CreatedAt:     string;
  ExpiresAt?:    string;
  LastUsedAt?:   string;
  UserId?:       Int64;
  AllowedCidrs?: string;   // CSV of networks; absent allows any address
}

/** keel `api_key/generate` request; blank scopes are the product `ScopePolicy`'s to supply. */
export type NewApiKey = {
  key_name:      string;
  scopes:        string;   // CSV
  allowed_cidrs: string;
  /** RFC 3339; absent never expires. */
  expires_at?:   string;
};

/** keel `api_key/generate` reply: the plaintext is shown once and never stored. */
export interface MintedApiKey {
  api_key:    string;
  key_prefix: string;
}

/** An OAuth client the signed-in user authorized on keel's authorization server (`authserver.Grant`). */
export interface OAuthGrant {
  clientId:     string;
  clientName:   string;
  scopes:       string[];
  authorizedAt: string;
  lastIssuedAt: string;
}
