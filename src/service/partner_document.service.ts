import { inject, Injectable } from '@angular/core';
import { HttpEvent, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { BaseRestService } from './base_rest.service';
import { BackendService } from './rest_service';
import { RestURL } from './rest_url';
import { DocumentSubject, DocumentUploadRequest, PartnerDocument } from '../model/document';
import { Int64, isPresentId } from '../util/integer';

/** keel's `document.PartnerDocument`: column names, empty values omitted. */
interface DocumentHandlerResponse {
  id: Int64;
  contrep_id: string;
  doc_key: string;
  partner_id: Int64;
  user_id?: Int64;
  subject_key?: string;
  document_type: string;
  title: string;
  file_name: string;
  version_no: number;
  document_number?: string;
  expires_on?: string;
  language?: string;
  origin_ip?: string;
  uploaded_by?: Int64;
  uploaded_at?: string;
  status: string;
  reviewer_id?: Int64;
  reviewed_at?: string;
  reviewer_notes?: string;
  superseded_at?: string;
  retired_at?: string;
  purged_at?: string;
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

function normalizeDocument(doc: DocumentHandlerResponse): PartnerDocument {
  return {
    Id: doc.id,
    ContrepId: doc.contrep_id,
    DocKey: doc.doc_key,
    PartnerId: doc.partner_id,
    UserId: doc.user_id ?? null,
    SubjectKey: doc.subject_key ?? null,
    DocumentType: doc.document_type,
    Title: doc.title,
    FileName: doc.file_name,
    VersionNo: doc.version_no,
    DocumentNumber: doc.document_number ?? null,
    ExpiresOn: doc.expires_on ?? null,
    Language: doc.language ?? null,
    OriginIp: doc.origin_ip ?? null,
    UploadedBy: doc.uploaded_by ?? null,
    UploadedAt: doc.uploaded_at ?? '',
    Status: doc.status,
    ReviewerId: doc.reviewer_id ?? null,
    ReviewedAt: doc.reviewed_at ?? null,
    ReviewerNotes: doc.reviewer_notes ?? null,
    SupersededAt: doc.superseded_at ?? null,
    RetiredAt: doc.retired_at ?? null,
    PurgedAt: doc.purged_at ?? null,
  };
}
