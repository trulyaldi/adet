// Startup timing, in development only. Imported first in index.ts, so the
// mark is taken before any other module runs.

const jsStart = Date.now();
let logged = false;

/** Log how long the first screen took from the bundle starting to run (dev builds only). */
export function logFirstScreen(): void {
  if (!__DEV__ || logged) return;
  logged = true;
  // After the frame that shows it.
  requestAnimationFrame(() => console.log(`[startup] first screen ${Date.now() - jsStart}ms after JS start`));
}
