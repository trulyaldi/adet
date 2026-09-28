import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { Companion } from './Companion';
import { IconButton } from './Glyph';

interface State {
  failed: boolean;
}

/**
 * If a screen crashes, show the dozing companion and a retry button instead
 * of a blank app. Data lives in the store above, so retrying loses nothing.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[ui]', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Fallback onRetry={() => this.setState({ failed: false })} />;
  }
}

function Fallback({ onRetry }: { onRetry(): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: colors.bg }}>
      <Companion mood="sleepy" size={120} />
      <IconButton label="Try again" name="undo" size={24} color={colors.onBrand} bg={colors.brand} edge={colors.brandDark} variant="chunky" diameter={60} onPress={onRetry} />
    </View>
  );
}
