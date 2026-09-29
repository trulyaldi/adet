// Web: Skia needs CanvasKit (WebAssembly) before any Skia code runs. It's
// fetched from jsDelivr, pinned to the installed canvaskit-wasm; if it can't
// load (offline), the fallback stays up instead of crashing.

import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import React from 'react';

const CANVASKIT = 'https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/';

class Boundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SkiaGate<P extends object>({
  load,
  props,
  fallback = null,
}: {
  load: () => Promise<{ default: React.ComponentType<P> }>;
  props: P;
  fallback?: React.ReactNode;
}) {
  return (
    <Boundary fallback={fallback}>
      <WithSkiaWeb getComponent={load} fallback={fallback} opts={{ locateFile: (file: string) => CANVASKIT + file }} componentProps={props as never} />
    </Boundary>
  );
}
