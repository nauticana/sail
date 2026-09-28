import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { BaseAsync } from '../abstract/base_async';
import { PartnerDocument } from '../../model/document';
import { LabelService } from '../../service/label.service';
import { PartnerDocumentService } from '../../service/partner_document.service';
import { DocumentUploadComponent } from './document_upload';

@Component({
  selector: 'sail-partner-documents',
  templateUrl: './partner_documents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [DatePipe, MatButtonModule, MatIconModule, DocumentUploadComponent],
})
export class PartnerDocumentsComponent extends BaseAsync implements OnInit {
  private readonly service = inject(PartnerDocumentService);
  private readonly labels = inject(LabelService);

  readonly userId = input<number | undefined>(undefined);
  readonly heading = input('Documents');
  readonly emptyMessage = input('No documents uploaded.');
  readonly expiringWithinDays = input(30);

  readonly documents = signal<PartnerDocument[]>([]);
  readonly reuploading = signal<PartnerDocument | null>(null);
  readonly statusesReady = signal(false);
  readonly latest = computed(() => latestByType(this.documents()));

  ngOnInit(): void {
    this.run(forkJoin({
      labels: this.labels.loadLabels('partner_document_status'),
      documents: this.service.list(this.userId()),
    }), ({ documents }) => {
      this.statusesReady.set(true);
      this.documents.set(documents);
    }, 'Could not load documents.');
  }

  reload(): void {
    this.run(this.service.list(this.userId()), (rows) => this.documents.set(rows), 'Could not load documents.');
  }

  status(status: string): string {
    return this.statusesReady() ? this.labels.requireLabel('partner_document_status', status) : '';
  }

  canReupload(doc: PartnerDocument): boolean {
    return doc.Status === 'N' || isExpiring(doc.ExpiresOn, this.expiringWithinDays());
  }

  preview(doc: PartnerDocument): void {
    // Opened synchronously so the popup blocker allows it; 'noopener' would return null.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    this.service.previewUrl(doc.Id).subscribe({
      next: (url) => {
        if (tab) tab.location.href = url;
        else window.open(url, '_blank', 'noopener');
      },
      error: (err) => {
        tab?.close();
        this.setError(err, 'Could not open the document.');
      },
    });
  }

  uploaded(): void {
    this.reuploading.set(null);
    this.reload();
  }
}

function latestByType(rows: PartnerDocument[]): PartnerDocument[] {
  const latest = new Map<string, PartnerDocument>();
  for (const row of rows) {
    const key = `${row.UserId ?? ''}:${row.DocumentType}`;
    const current = latest.get(key);
    if (!current || row.VersionNo > current.VersionNo) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => a.DocumentType.localeCompare(b.DocumentType));
}

function isExpiring(value: string | null, withinDays: number): boolean {
  if (!value || withinDays < 0) return false;
  const expires = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() <= Date.now() + withinDays * 86400000;
}
