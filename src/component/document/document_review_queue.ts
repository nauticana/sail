import { ChangeDetectionStrategy, Component, OnInit, SecurityContext, ViewEncapsulation, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BaseAsync } from '../abstract/base_async';
import { PartnerDocument } from '../../model/document';
import { PartnerDocumentService } from '../../service/partner_document.service';

@Component({
  selector: 'sail-document-review-queue',
  templateUrl: './document_review_queue.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class DocumentReviewQueueComponent extends BaseAsync implements OnInit {
  private readonly service = inject(PartnerDocumentService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly documents = signal<PartnerDocument[]>([]);
  readonly preview = signal<{ id: number; url: SafeResourceUrl } | null>(null);
  readonly reviewing = signal<number | null>(null);
  readonly notes = signal<Record<number, string>>({});

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.run(this.service.pending(), (rows) => this.documents.set(rows), 'Could not load pending documents.');
  }

  showPreview(doc: PartnerDocument): void {
    this.service.previewUrl(doc.Id).subscribe({
      next: (url) => {
        const safe = this.sanitizer.sanitize(SecurityContext.URL, url);
        if (!safe) {
          this.errorMessage.set('The document preview URL is invalid.');
          return;
        }
        this.preview.set({ id: doc.Id, url: this.sanitizer.bypassSecurityTrustResourceUrl(safe) });
      },
      error: (err) => this.setError(err, 'Could not preview the document.'),
    });
  }

  setNotes(id: number, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.notes.update((notes) => ({ ...notes, [id]: value }));
  }

  review(doc: PartnerDocument, approve: boolean): void {
    this.reviewing.set(doc.Id);
    this.service.review(doc.Id, approve, this.notes()[doc.Id] ?? '').subscribe({
      next: () => {
        this.documents.update((rows) => rows.filter((row) => row.Id !== doc.Id));
        if (this.preview()?.id === doc.Id) this.preview.set(null);
        this.reviewing.set(null);
      },
      error: (err) => {
        this.reviewing.set(null);
        this.setError(err, 'Could not review the document.');
      },
    });
  }
}
