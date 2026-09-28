import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PartnerDocumentService } from '../../service/partner_document.service';
import { PartnerDocument } from '../../model/document';
import { errorDetail } from '../../util/errors';

/**
 * Picks, previews and uploads one keel partner document. App-specific
 * attestations are projected content; bind `[canUpload]` to their state.
 * Ships no CSS — style the `.document-upload*` classes globally.
 */
@Component({
  selector: 'sail-document-upload',
  templateUrl: './document_upload.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
})
export class DocumentUploadComponent {
  private readonly documents = inject(PartnerDocumentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly documentType = input.required<string>();
  readonly title = input('');
  readonly documentNumber = input('');
  /** YYYY-MM-DD. */
  readonly expiresOn = input('');
  readonly userId = input<number | undefined>(undefined);
  readonly accept = input('image/*,application/pdf');
  /** Client-side size cap; 0 leaves the limit to keel's document type. */
  readonly maxBytes = input(0);
  readonly label = input('Choose file');
  readonly canUpload = input(true);

  readonly uploaded = output<PartnerDocument>();
  /** The raw error; branch on `errorCode(err)` (keel's `document_*` codes). */
  readonly failed = output<unknown>();

  readonly file = signal<File | null>(null);
  readonly progress = signal<number | null>(null);
  readonly errorMessage = signal('');
  private readonly objectUrl = signal<string | null>(null);

  readonly isImage = computed(() => this.file()?.type.startsWith('image/') ?? false);
  readonly imageUrl = computed(() => (this.isImage() ? this.objectUrl() : null));
  readonly pdfUrl = computed(() => (this.file()?.type === 'application/pdf' ? this.objectUrl() : null));
  readonly uploading = computed(() => this.progress() !== null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.errorMessage.set('');
    this.revokePreview();
    this.file.set(null);
    if (!file) return;
    const max = this.maxBytes();
    if (max > 0 && file.size > max) {
      this.errorMessage.set(`The file exceeds the ${(max / 1048576).toFixed(1)} MB limit.`);
      return;
    }
    this.file.set(file);
    this.objectUrl.set(URL.createObjectURL(file));
  }

  upload(): void {
    const file = this.file();
    if (!file || !this.canUpload() || this.uploading()) return;
    this.errorMessage.set('');
    this.progress.set(0);
    this.documents.upload(file, {
      documentType: this.documentType(),
      title: this.title() || undefined,
      documentNumber: this.documentNumber() || undefined,
      expiresOn: this.expiresOn() || undefined,
      userId: this.userId(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.progress.set(null);
          this.clear();
          this.uploaded.emit(event.body);
        }
      },
      error: (err) => {
        this.progress.set(null);
        this.errorMessage.set(errorDetail(err, 'Upload failed.'));
        this.failed.emit(err);
      },
    });
  }

  clear(): void {
    this.revokePreview();
    this.file.set(null);
  }

  private revokePreview(): void {
    const url = this.objectUrl();
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
  }
}
