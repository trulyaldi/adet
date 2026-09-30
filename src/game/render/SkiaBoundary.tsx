// Catches a failed Skia screen (a load that throws, a draw that throws) so it
// shows a calm stand-in instead of a red screen, and tells the caller, so a
// ceremony can finish and a sheet can still close. Never blocks the app.

import React from 'react';

export class SkiaBoundary extends React.Component<{ fallback: React.ReactNode; onError?(e: unknown): void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    this.props.onError?.(e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
