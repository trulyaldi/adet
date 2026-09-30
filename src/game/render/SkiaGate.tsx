// Draws a Skia screen loaded at first use (see screens.ts: a synchronous
// require on native, so no async bundle is ever fetched), inside an error
// boundary. On web, SkiaGate.web.tsx loads CanvasKit first.

import React from 'react';

import { SkiaBoundary } from './SkiaBoundary';

type Mod<P> = { default: React.ComponentType<P> };

/** `load` must be a module-level function from screens.ts. */
export function SkiaGate<P extends object>({
  load,
  props,
  fallback = null,
  errorFallback,
  onError,
}: {
  load: () => Mod<P> | Promise<Mod<P>>;
  props: P;
  fallback?: React.ReactNode;
  /** Shown if the screen fails (default: `fallback`). */
  errorFallback?: React.ReactNode;
  onError?(e: unknown): void;
}) {
  return (
    <SkiaBoundary fallback={errorFallback ?? fallback} onError={onError}>
      <Loaded load={load} props={props} />
    </SkiaBoundary>
  );
}

function Loaded<P extends object>({ load, props }: { load: () => Mod<P> | Promise<Mod<P>>; props: P }) {
  const mod = load();
  if (mod instanceof Promise) throw new Error('SkiaGate: native loaders must be synchronous (screens.ts)');
  const C = mod.default;
  return <C {...props} />;
}
