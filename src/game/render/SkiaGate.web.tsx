// Web: Skia needs CanvasKit (WebAssembly) before any Skia code runs. It's
// fetched from jsDelivr, pinned to the installed canvaskit-wasm; if it can't
// load (offline), the fallback stays up instead of crashing.

import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import React from 'react';

import { SkiaBoundary } from './SkiaBoundary';

const CANVASKIT = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/';

export function SkiaGate<P extends object>({
  load,
  props,
  fallback = null,
  errorFallback,
  onError,
}: {
  load: () => Promise<{ default: React.ComponentType<P> }>;
  props: P;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  onError?(e: unknown): void;
}) {
  return (
    <SkiaBoundary fallback={errorFallback ?? fallback} onError={onError}>
      <WithSkiaWeb getComponent={load} fallback={fallback} opts={{ locateFile: (file: string) => CANVASKIT + file }} componentProps={props as never} />
    </SkiaBoundary>
  );
}
