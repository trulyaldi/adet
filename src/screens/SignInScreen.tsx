import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';

import { AdetMark } from '../components/AdetMark';
import { Press } from '../components/motion/Press';
import { supabase } from '../sync/supabase';
import { inputStyle } from '../theme/styles';
import { useTheme } from '../theme/ThemeProvider';

const CODE_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'code';

export function SignInScreen() {
  const { colors, radius, shadow } = useTheme();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const codeValid = code.length === CODE_LENGTH;

  const sendCode = async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (step === 'code') setNotice('A new code is on its way.');
    setStep('code');
  };

  const verify = async (token: string) => {
    if (token.length !== CODE_LENGTH || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token,
      type: 'email',
    });
    // On success the auth listener swaps this screen out for the app.
    if (err) {
      setLoading(false);
      setError(err.message);
      setCode('');
    }
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) verify(digits);
  };

  const useDifferentEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setNotice(null);
  };

  const canSubmit = step === 'email' ? emailValid : codeValid;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 20 }}
    >
      <View style={{ marginBottom: 16 }}>
        <AdetMark height={36} />
      </View>
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>
        {step === 'email' ? 'Sign in' : 'Check your email'}
      </Text>
      <Text style={{ fontSize: 15, color: colors.sub, marginTop: 3, lineHeight: 21 }}>
        {step === 'email'
          ? "We'll email you a 6-digit code."
          : `Enter the 6-digit code sent to ${trimmedEmail}.`}
      </Text>

      <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 18, gap: 15 }, shadow]}>
        {step === 'email' ? (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub, marginBottom: 8 }}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              onSubmitEditing={sendCode}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              editable={!loading}
              autoFocus
              style={inputStyle(colors, radius)}
            />
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub, marginBottom: 8 }}>Code</Text>
            <TextInput
              value={code}
              onChangeText={onCodeChange}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              editable={!loading}
              autoFocus
              style={[inputStyle(colors, radius), { fontSize: 24, fontWeight: '700', letterSpacing: 8, textAlign: 'center', fontVariant: ['tabular-nums'] }]}
            />
          </View>
        )}

        {error && (
          <View style={{ backgroundColor: colors.amberBg, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.amber }}>{error}</Text>
          </View>
        )}
        {notice && !error && <Text style={{ fontSize: 13, color: colors.sub }}>{notice}</Text>}

        <Press
          kind="button"
          disabled={!canSubmit || loading}
          onPress={step === 'email' ? sendCode : () => verify(code)}
          style={{
            borderRadius: radius.lg,
            padding: 16,
            alignItems: 'center',
            backgroundColor: colors.brand,
            opacity: canSubmit && !loading ? 1 : 0.4,
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onBrand }}>
              {step === 'email' ? 'Send code' : 'Verify'}
            </Text>
          )}
        </Press>

        {step === 'code' && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Press kind="icon" disabled={loading} onPress={useDifferentEmail} style={{ padding: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub }}>Use a different email</Text>
            </Press>
            <Press kind="icon" disabled={loading} onPress={sendCode} style={{ padding: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>Resend code</Text>
            </Press>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
