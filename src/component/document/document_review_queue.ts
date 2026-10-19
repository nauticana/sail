import {
  ChangeDetectionStrategy, Component, SecurityContext, ViewEncapsulation, computed, effect, inject, input, output, signal,
} from '@angular/core';
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
export class DocumentReviewQueueComponent extends BaseAsync {
  private readonly service = inject(PartnerDocumentService);
  private readonly sanitizer = inject(DomSanitizer);

  /** One member's documents; all pending documents when absent. */
  readonly userId = input<number>();
  /** Limits the queue to these document_type codes; all types when absent. */
  readonly documentTypes = input<readonly string[]>();
  readonly reviewed = output<{ id: number; approved: boolean }>();

  private readonly pendingRows = signal<PartnerDocument[]>([]);
  readonly documents = computed(() => {
    const types = this.documentTypes();
    return types ? this.pendingRows().filter((doc) => types.includes(doc.DocumentType)) : this.pendingRows();
  });
  readonly preview = signal<{ id: number; url: SafeResourceUrl } | null>(null);
  readonly reviewing = signal<number | null>(null);
  readonly notes = signal<Record<number, string>>({});

  private readonly userIdEffect = effect(() => this.reload());

  reload(): void {
    const userId = this.userId();
    this.run(this.service.pending(userId), (rows) => {
      // A slower response for a member no longer shown must not replace the current list.
      if (userId === this.userId()) this.pendingRows.set(rows);
    }, 'Could not load pending documents.');
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
        this.pendingRows.update((rows) => rows.filter((row) => row.Id !== doc.Id));
        if (this.preview()?.id === doc.Id) this.preview.set(null);
        this.reviewing.set(null);
        this.reviewed.emit({ id: doc.Id, approved: approve });
      },
      error: (err) => {
        this.reviewing.set(null);
        this.setError(err, 'Could not review the document.');
      },
    });
  }
}
