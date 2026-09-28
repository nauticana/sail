import { inject, Injectable } from '@angular/core';
import { HttpEvent, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { DocumentUploadRequest, PartnerDocument } from '../model/document';

interface DocumentHandlerResponse {
  ID: number;
  ContRepID: string;
  DocKey: string;
  PartnerID: number;
  UserID: number;
  DocumentType: string;
  Title: string;
  FileName: string;
  VersionNo: number;
  DocumentNumber: string;
  ExpiresOn: string;
  OriginIP: string;
  UploadedBy: number;
  UploadedAt: string;
  Status: string;
  ReviewerID: number;
  ReviewedAt: string;
  ReviewerNotes: string;
  SupersededAt: string;
  RetiredAt: string;
  PurgedAt: string;
}

/** Client for keel's `handler.DocumentHandler` and `partner_document` REST table. */
@Injectable({ providedIn: 'root' })
export class PartnerDocumentService extends BaseRestService {
  private readonly backend = inject(BackendService);

  list(userId?: number): Observable<PartnerDocument[]> {
    const filter = userId === undefined ? undefined : { UserId: String(userId) };
    return this.backend.list<PartnerDocument>('partner_document', filter);
  }

  pending(): Observable<PartnerDocument[]> {
    return this.backend.list<PartnerDocument>('partner_document', { Status: 'P' });
  }

  /** Multipart upload with progress events; the final response carries the stored document. */
  upload(file: File, request: DocumentUploadRequest): Observable<HttpEvent<PartnerDocument>> {
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', request.documentType);
    if (request.title) form.append('title', request.title);
    if (request.documentNumber) form.append('document_number', request.documentNumber);
    if (request.expiresOn) form.append('expires_on', request.expiresOn);
    if (request.userId) form.append('user_id', String(request.userId));
    return this.http.post<DocumentHandlerResponse>(this.url(RestURL.partnerDocumentUploadURL), form, {
      reportProgress: true,
      observe: 'events',
    }).pipe(map((event) => normalizeUploadEvent(event)));
  }

  /** Short-lived signed read URL. */
  previewUrl(id: number): Observable<string> {
    const params = new HttpParams().set('id', id);
    return this.http.get<{ url: string }>(this.url(RestURL.partnerDocumentPreviewURL), { params })
      .pipe(map((resp) => resp.url));
  }

  review(id: number, approve: boolean, notes = ''): Observable<void> {
    // keel decodes the id with `json:"id,string"`.
    return this.http.post<void>(this.url(RestURL.partnerDocumentReviewURL), { id: String(id), approve, notes });
  }
}

function normalizeUploadEvent(event: HttpEvent<DocumentHandlerResponse>): HttpEvent<PartnerDocument> {
  if (event.type !== HttpEventType.Response) return event;
  return (event as HttpResponse<DocumentHandlerResponse>).clone({
    body: event.body ? normalizeDocument(event.body) : null,
  });
}

/** DocumentHandler answers with keel's Go struct: zero values stand for the row's NULLs. */
function normalizeDocument(doc: DocumentHandlerResponse): PartnerDocument {
  return {
    Id: doc.ID,
    ContrepId: doc.ContRepID,
    DocKey: doc.DocKey,
    PartnerId: doc.PartnerID,
    UserId: doc.UserID || null,
    DocumentType: doc.DocumentType,
    Title: doc.Title,
    FileName: doc.FileName,
    VersionNo: doc.VersionNo,
    DocumentNumber: doc.DocumentNumber || null,
    ExpiresOn: timeOrNull(doc.ExpiresOn),
    OriginIp: doc.OriginIP || null,
    UploadedBy: doc.UploadedBy || null,
    UploadedAt: doc.UploadedAt,
    Status: doc.Status,
    ReviewerId: doc.ReviewerID || null,
    ReviewedAt: timeOrNull(doc.ReviewedAt),
    ReviewerNotes: doc.ReviewerNotes || null,
    SupersededAt: timeOrNull(doc.SupersededAt),
    RetiredAt: timeOrNull(doc.RetiredAt),
    PurgedAt: timeOrNull(doc.PurgedAt),
  };
}

function timeOrNull(value: string): string | null {
  return !value || value.startsWith('0001-01-01') ? null : value;
}
