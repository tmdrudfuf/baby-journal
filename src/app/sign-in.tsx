import { useState } from 'react';

import { Button, Field, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';

export default function SignInScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === 'signUp' ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) setMessage(t(error.message)); // known Supabase messages are in the dictionary
    else if (!data.session) setMessage(t('Check your email to confirm your account, then sign in.'));
    // On success the auth listener moves us on.
  }

  const valid = /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8;

  return (
    <Screen>
      <Text variant="display" style={{ marginTop: 48 }}>
        {t('Baby Journal')}
      </Text>
      <Text color="textSecondary">{t('Record in 10 seconds. Remember forever.')}</Text>
      <Field label={t('Email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field
        label={t('Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
        placeholder={t('At least 8 characters')}
      />
      {message && (
        <Text color="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <Button label={mode === 'signUp' ? t('Create account') : t('Sign in')} onPress={submit} disabled={!valid || busy} />
      <Button
        variant="ghost"
        label={mode === 'signUp' ? t('I already have an account') : t('Create a new account')}
        onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
      />
    </Screen>
  );
}
