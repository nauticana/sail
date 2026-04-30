/**
 * Dynamic external <script> loader. Used by SocialLoginComponent to bring
 * in Google Identity Services / Apple JS on demand instead of bundling them.
 * Caches by URL — subsequent calls for the same URL resolve immediately.
 */
const cache = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = cache.get(src);
  if (existing) return existing;

  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('loadScript: no document (SSR?)'));
      return;
    }
    const prior = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (prior) { resolve(); return; }

    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });

  cache.set(src, p);
  return p;
}
