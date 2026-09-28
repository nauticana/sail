/** One `partner_document` row in Sail's generic REST field shape. */
export interface PartnerDocument {
  Id:             number;
  ContrepId:      string;
  DocKey:         string;
  PartnerId:      number;
  /** null means the partner itself. */
  UserId:         number | null;
  DocumentType:   string;
  Title:          string;
  FileName:       string;
  VersionNo:      number;
  DocumentNumber: string | null;
  ExpiresOn:      string | null;
  OriginIp:       string | null;
  UploadedBy:     number | null;
  UploadedAt:     string;
  /** `partner_document_status`: P pending, Y approved, N rejected, X superseded, R retired. */
  Status:         string;
  ReviewerId:     number | null;
  ReviewedAt:     string | null;
  ReviewerNotes:  string | null;
  SupersededAt:   string | null;
  RetiredAt:      string | null;
  PurgedAt:       string | null;
}

export interface DocumentUploadRequest {
  documentType:    string;
  title?:          string;
  documentNumber?: string;
  /** YYYY-MM-DD. */
  expiresOn?:      string;
  /** The member the document is about; omitted = the partner. */
  userId?:         number;
}
