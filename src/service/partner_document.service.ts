import { inject, Injectable } from '@angular/core';
import { HttpEvent, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { DocumentSubject, DocumentUploadRequest, PartnerDocument } from '../model/document';
import { Int64, isPresentId } from '../util/integer';

interface DocumentHandlerResponse {
  ID: Int64;
  ContRepID: string;
  DocKey: string;
  PartnerID: Int64;
  UserID: Int64;
  SubjectKey: string;
  DocumentType: string;
  Title: string;
  FileName: string;
  VersionNo: number;
  DocumentNumber: string;
  ExpiresOn: string;
  Language: string;
  OriginIP: string;
  UploadedBy: Int64;
  UploadedAt: string;
  Status: string;
  ReviewerID: Int64;
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

  /** Rows narrowed to the subject's member or record; an absent or empty subject lists every subject. */
  list(subject?: DocumentSubject, status?: string): Observable<PartnerDocument[]> {
    if (namesBothSubjects(subject)) return bothSubjectsError();
    return this.backend.list<PartnerDocument>('partner_document', {
      ...(isPresentId(subject?.userId) ? { UserId: subject.userId } : {}),
      ...(subject?.subjectKey ? { SubjectKey: subject.subjectKey } : {}),
      ...(status === undefined ? {} : { Status: status }),
    });
  }

  pending(subject?: DocumentSubject): Observable<PartnerDocument[]> {
    return this.list(subject, 'P');
  }

  /** Multipart upload with progress events; the final response carries the stored document. */
  upload(file: File, request: DocumentUploadRequest): Observable<HttpEvent<PartnerDocument>> {
    if (namesBothSubjects(request)) return bothSubjectsError();
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', request.documentType);
    if (request.title) form.append('title', request.title);
    if (request.documentNumber) form.append('document_number', request.documentNumber);
    if (request.expiresOn) form.append('expires_on', request.expiresOn);
    if (request.language) form.append('language', request.language);
    if (isPresentId(request.userId)) form.append('user_id', request.userId);
    if (request.subjectKey) form.append('subject_key', request.subjectKey);
    return this.http.post<DocumentHandlerResponse>(this.url(RestURL.partnerDocumentUploadURL), form, {
      reportProgress: true,
      observe: 'events',
    }).pipe(map((event) => normalizeUploadEvent(event)));
  }

  /** Short-lived signed read URL. */
  previewUrl(id: Int64): Observable<string> {
    const params = new HttpParams().set('id', id);
    return this.http.get<{ url: string }>(this.url(RestURL.partnerDocumentPreviewURL), { params })
      .pipe(map((resp) => resp.url));
  }

  review(id: Int64, approve: boolean, notes = ''): Observable<void> {
    return this.http.post<void>(this.url(RestURL.partnerDocumentReviewURL), { id, approve, notes });
  }
}

function namesBothSubjects(subject?: DocumentSubject): boolean {
  return isPresentId(subject?.userId) && !!subject.subjectKey;
}

/** Refused here rather than by keel so the request never leaves the browser. */
function bothSubjectsError(): Observable<never> {
  return throwError(() => new Error('A document is about a member or a record, not both.'));
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
    UserId: idOrNull(doc.UserID),
    SubjectKey: doc.SubjectKey || null,
    DocumentType: doc.DocumentType,
    Title: doc.Title,
    FileName: doc.FileName,
    VersionNo: doc.VersionNo,
    DocumentNumber: doc.DocumentNumber || null,
    ExpiresOn: timeOrNull(doc.ExpiresOn),
    Language: doc.Language || null,
    OriginIp: doc.OriginIP || null,
    UploadedBy: idOrNull(doc.UploadedBy),
    UploadedAt: doc.UploadedAt,
    Status: doc.Status,
    ReviewerId: idOrNull(doc.ReviewerID),
    ReviewedAt: timeOrNull(doc.ReviewedAt),
    ReviewerNotes: doc.ReviewerNotes || null,
    SupersededAt: timeOrNull(doc.SupersededAt),
    RetiredAt: timeOrNull(doc.RetiredAt),
    PurgedAt: timeOrNull(doc.PurgedAt),
  };
}

function idOrNull(value: Int64): Int64 | null {
  return isPresentId(value) ? value : null;
}

function timeOrNull(value: string): string | null {
  return !value || value.startsWith('0001-01-01') ? null : value;
}
