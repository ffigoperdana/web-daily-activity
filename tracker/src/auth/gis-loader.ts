/**
 * Loads the Google Identity Services client library script exactly once.
 * Resolves when the script fires its `load` event; rejects on `error`.
 * If the script tag already exists in the document, resolves immediately.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export function loadGisScript(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // If the script tag already exists, resolve immediately.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;

    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(new Error(`Failed to load GIS script: ${GIS_SRC}`)),
    );

    document.head.appendChild(script);
  });
}
