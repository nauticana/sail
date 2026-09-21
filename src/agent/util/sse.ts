export interface ServerSentEvent {
  event: string;
  data: string;
}

/**
 * Incremental `text/event-stream` parser. A fetch body reader hands it decoded chunks —
 * which split anywhere — and it returns only whole events.
 */
export class SseParser {
  private buffer = '';
  private pendingCarriageReturn = false;

  push(chunk: string): ServerSentEvent[] {
    // An empty chunk must not resolve a pending CR: the LF completing it may still be coming.
    if (!chunk) return [];
    if (this.pendingCarriageReturn) {
      this.buffer += '\n';
      this.pendingCarriageReturn = false;
      if (chunk.startsWith('\n')) chunk = chunk.slice(1);
    }
    if (chunk.endsWith('\r')) {
      this.pendingCarriageReturn = true;
      chunk = chunk.slice(0, -1);
    }
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    return this.drain();
  }

  /** Resolve a final standalone carriage return when the response body closes. */
  finish(): ServerSentEvent[] {
    if (this.pendingCarriageReturn) {
      this.buffer += '\n';
      this.pendingCarriageReturn = false;
    }
    return this.drain();
  }

  private drain(): ServerSentEvent[] {
    const events: ServerSentEvent[] = [];
    for (let end = this.buffer.indexOf('\n\n'); end !== -1; end = this.buffer.indexOf('\n\n')) {
      const event = parseBlock(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end + 2);
      if (event) events.push(event);
    }
    return events;
  }
}

function parseBlock(block: string): ServerSentEvent | undefined {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split(/\r\n|\r|\n/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const raw = colon === -1 ? '' : line.slice(colon + 1);
    const value = raw.startsWith(' ') ? raw.slice(1) : raw;
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  return data.length ? { event, data: data.join('\n') } : undefined;
}
