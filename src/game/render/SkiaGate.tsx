// Loads Skia-drawn screens lazily, so Skia never runs on the app's start-up
// path. (On web, SkiaGate.web.tsx loads CanvasKit first.)

import React, { Suspense } from 'react';

type AnyComponent = React.ComponentType<any>;
type Loader = () => Promise<{ default: AnyComponent }>;

// One lazy component per loader, made once: callers pass module-level
// loaders, so a re-render never recreates (and remounts) the screen.
const lazies = new WeakMap<Loader, React.LazyExoticComponent<AnyComponent>>();
function lazyFor(load: Loader) {
  const c = lazies.get(load) ?? React.lazy(load);
  lazies.set(load, c);
  return c;
}

/** `load` must be a module-level function (not an inline arrow). */
export function SkiaGate<P extends object>({
  load,
  props,
  fallback = null,
}: {
  load: () => Promise<{ default: React.ComponentType<P> }>;
  props: P;
  fallback?: React.ReactNode;
}) {
  const Lazy = lazyFor(load as Loader) as unknown as React.ComponentType<P>;
  return (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
}
