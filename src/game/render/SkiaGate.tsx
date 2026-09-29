// Loads Skia-drawn screens lazily, so Skia never runs on the app's start-up
// path. (On web, SkiaGate.web.tsx loads CanvasKit first.)

import React, { Suspense, useMemo } from 'react';

export function SkiaGate<P extends object>({
  load,
  props,
  fallback = null,
}: {
  load: () => Promise<{ default: React.ComponentType<P> }>;
  props: P;
  fallback?: React.ReactNode;
}) {
  const Lazy = useMemo(() => React.lazy(load), []);
  return (
    <Suspense fallback={fallback}>
      <Lazy {...props} />
    </Suspense>
  );
}
