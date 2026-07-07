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
    if (prior) {
      // A tag we (or the host page) already inserted may still be loading —
      // resolve on its load event, not on mere presence in the DOM.
      if (prior.dataset['sailLoaded']) { resolve(); return; }
      prior.addEventListener('load', () => resolve());
      prior.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }

    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.defer = true;
    el.onload = () => { el.dataset['sailLoaded'] = 'true'; resolve(); };
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });

  cache.set(src, p);
  // Evict failures so a transient network error doesn't disable the feature
  // (e.g. social login) for the rest of the page's lifetime.
  p.catch(() => cache.delete(src));
  return p;
}
