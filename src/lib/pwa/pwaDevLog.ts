const PREFIX = '[PWA]';

export function pwaDevLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console -- logs dev-only demandés
    console.info(PREFIX, ...args);
  }
}

/** Logs optionnels en prod si NEXT_PUBLIC_DEBUG_PWA=1 (support prod investigations). */
export function pwaDebugLog(...args: unknown[]): void {
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_DEBUG_PWA === '1'
  ) {
    // eslint-disable-next-line no-console
    console.info(PREFIX, ...args);
  }
}
