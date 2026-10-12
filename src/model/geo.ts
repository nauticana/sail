/** Rows of keel's `currency` and `country` tables as generic REST returns them. */
export interface Currency {
  Code:     string;  // ISO 4217
  Caption:  string;
  Exponent: number;  // minor-unit decimals, 0–6
}

export interface Country {
  Id:       string;  // ISO 3166-1 alpha-2
  Caption:  string;
  Currency: string;  // default ISO 4217 code
}
