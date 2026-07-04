// Partner→external-provider connections (keel oauth/connect). The app supplies a
// OAuthProviderDescriptor[] catalog; sail's ConnectionPanel renders/manages them.

/** Mirrors keel partner_credential (the browser never sees the sealed cred_ref). */
export interface PartnerCredential {
  Id?: number;
  PartnerId?: number;
  /** 0 = tenant-wide; >0 = a specific business/entity. */
  EntityId?: number;
  Provider: string;
  /** 'O' = OAuth, 'A' = API key. */
  ConnectionType: 'O' | 'A';
  /** 'A' active, 'E' error, 'P' pending, 'I' inactive. */
  Status: 'A' | 'E' | 'P' | 'I';
  ApiEndpoint?: string;
  LastChecked?: string;
}

// credential = sealed secret; endpoint = api_endpoint; param = OAuth authorize query param.
export type OAuthProviderFieldRole = 'credential' | 'endpoint' | 'param';

// role is explicit so field order can't mistake a URL for the credential.
export interface OAuthProviderField {
  key: string;
  label: string;
  role: OAuthProviderFieldRole;
  placeholder?: string;
  type?: 'text' | 'password';
  required?: boolean;
}

/** App-supplied catalog entry the ConnectionPanel renders. */
export interface OAuthProviderDescriptor {
  code: string;
  name: string;
  icon?: string; // Material icon name or an image URL (assets/icons/x.svg)
  authType: 'oauth' | 'api_key';
  description?: string;
  connectNote?: string;
  fields?: OAuthProviderField[]; // API-key: credential (+ endpoint); OAuth: param fields (Shopify shop)
}

export type OAuthConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';

/** A descriptor joined with its current stored connection + derived status. */
export interface OAuthConnectionView {
  provider: OAuthProviderDescriptor;
  connection?: PartnerCredential;
  status: OAuthConnectionStatus;
}
