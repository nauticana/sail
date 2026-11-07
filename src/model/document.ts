import { Int64 } from '../util/integer';

/** One `partner_document` row in Sail's generic REST field shape. */
export interface PartnerDocument {
  Id:             Int64;
  ContrepId:      string;
  DocKey:         string;
  PartnerId:      Int64;
  /** The member the document is about; null when it is about an application record or the partner. */
  UserId:         Int64 | null;
  /** The application record the document is about; null when it is about a member or the partner. */
  SubjectKey:     string | null;
  DocumentType:   string;
  Title:          string;
  FileName:       string;
  VersionNo:      number;
  DocumentNumber: string | null;
  ExpiresOn:      string | null;
  /** BCP 47 tag, at most 8 characters. */
  Language:       string | null;
  OriginIp:       string | null;
  UploadedBy:     Int64 | null;
  UploadedAt:     string;
  /** `partner_document_status`: P pending, Y approved, N rejected, X superseded, R retired. */
  Status:         string;
  ReviewerId:     Int64 | null;
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
  /** BCP 47 tag, at most 8 characters. */
  language?:       string;
  /** The member the document is about; exclusive with `subjectKey`; neither = the partner. */
  userId?:         Int64;
  /** The application record the document is about, at most 200 characters; exclusive with `userId`. */
  subjectKey?:     string;
}

/** What a list is narrowed to: a member, an application record, or (empty) every subject. */
export interface DocumentSubject {
  userId?:     Int64;
  subjectKey?: string;
}
