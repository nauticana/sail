/** A row of keel's `api_key` table as generic REST returns it; the hash never leaves keel. */
export interface ApiKey {
  Id:            number;
  KeyName:       string;
  KeyPrefix:     string;
  Scopes:        string;   // CSV
  IsActive:      boolean;
  CreatedAt:     string;
  ExpiresAt?:    string;
  LastUsedAt?:   string;
  UserId?:       number;
  AllowedCidrs?: string;   // CSV of networks; absent allows any address
}

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
