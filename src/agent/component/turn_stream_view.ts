import { ChangeDetectionStrategy, Component, TemplateRef, computed, input, output } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TurnExtensionEvent } from '../model/turn_event';
import { TurnStream } from '../service/turn_stream';
import { TurnEventListComponent } from './turn_event_list';

/**
 * One turn's stream: its events, its status, and a cancel request. The app owns the transport
 * and the cancel call; on `cancelRequested` it sends the request and calls
 * `stream.markCancelRequested()`. Selector: <sail-turn-stream-view>.
 */
@Component({
  selector: 'sail-turn-stream-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JsonPipe, MatButtonModule, MatProgressBarModule, TurnEventListComponent],
  templateUrl: './turn_stream_view.html',
})
export class TurnStreamViewComponent {
  readonly stream = input.required<TurnStream>();
  readonly extensionTemplate = input<TemplateRef<{ $implicit: TurnExtensionEvent }>>();

  readonly cancelRequested = output<string>();

  protected readonly status = computed(() => this.stream().status());
  protected readonly events = computed(() => this.stream().events());
  protected readonly finalFrame = computed(() => this.stream().finalFrame());
  protected readonly canCancel = computed(() => {
    const status = this.status();
    return status === 'streaming' || status === 'awaiting_approval';
  });
  /** A synthesized final frame carries the whole answer in its payload and no events. */
  protected readonly storedPayload = computed(() => {
    const frame = this.finalFrame();
    return frame && !frame.error_code && this.events().length === 0 ? frame.payload : undefined;
  });

  protected isText(payload: unknown): payload is string {
    return typeof payload === 'string';
  }

  protected requestCancel(): void {
    this.cancelRequested.emit(this.stream().requestId);
  }
}
