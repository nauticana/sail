import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

/**
 * Base class for components that perform async operations and need to show
 * loading / error / success state. Reduces the same signal boilerplate
 * across billing, security, and registration components.
 *
 * Subclasses use `run(obs, onSuccess, fallbackError)` to wire an Observable
 * into the shared state automatically.
 */
export abstract class BaseAsync {
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  /** Clear any prior messages. */
  protected clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  /**
   * Set errorMessage from an HTTP error object; falls back to `fallback`.
   *
   * Reads `err.error.detail` first (keel emits RFC 7807 ProblemDetail with
   * `detail` as the human-readable field), then `err.error.message` for
   * legacy / non-RFC-7807 endpoints, then the supplied fallback.
   */
  protected setError(err: unknown, fallback: string): void {
    const e = err as { error?: { detail?: string; message?: string } } | null | undefined;
    this.errorMessage.set(e?.error?.detail ?? e?.error?.message ?? fallback);
    this.loading.set(false);
  }

  /**
   * Subscribe to an Observable with shared loading/error semantics.
   * Clears messages, sets loading, invokes onSuccess on next, and routes
   * errors through setError with the given fallback message. Pass `onError`
   * when the component must also react to failures (e.g. emit an output).
   * The subscription is torn down with the component.
   */
  protected run<T>(
    obs: Observable<T>,
    onSuccess: (value: T) => void,
    fallbackError = 'Operation failed. Please try again.',
    onError?: (err: unknown) => void,
  ): void {
    this.clearMessages();
    this.loading.set(true);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.loading.set(false);
        onSuccess(value);
      },
      error: (err) => {
        this.setError(err, fallbackError);
        onError?.(err);
      },
    });
  }
}
