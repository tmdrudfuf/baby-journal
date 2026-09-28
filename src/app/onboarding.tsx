import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { formatDate, localDayKey } from '@/lib/dates';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { PENDING_INVITE_KEY, useApp } from '@/state/app';
import { t } from '@/lib/i18n';

const pendingInvite = () => {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY) ?? '';
  } catch {
    return '';
  }
};

export default function OnboardingScreen() {
  const { refresh, signOut } = useApp();
  const [mode, setMode] = useState<'create' | 'join'>(() => (pendingInvite() ? 'join' : 'create'));
  const [name, setName] = useState('');
  const [birth, setBirth] = useState(new Date());
  const [code, setCode] = useState(pendingInvite);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      refresh(); // app state re-reads family, baby and our role
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Something went wrong. Try again.'));
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const babyName = name.trim();
      // Reuse a family from an earlier attempt instead of creating a duplicate.
      const { data: existing } = await supabase.from('families').select('id').limit(1);
      let familyId = existing?.[0]?.id;
      if (!familyId) {
        const { data, error } = await supabase.rpc('create_family', { family_name: t("{name}'s family", { name: babyName }) });
        if (error) throw error;
        familyId = data;
      }
      const { error } = await supabase
        .from('babies')
        .insert({ family_id: familyId, name: babyName, birth_date: localDayKey(birth) });
      if (error) throw error;
      track('onboarding_completed');
    });

  const join = () =>
    run(async () => {
      const { error } = await supabase.rpc('accept_invitation', { token: code.trim() });
      if (error?.message.includes('full')) throw new Error(t('This family has reached its member limit. Ask the owner to remove someone or upgrade.'));
      if (error) throw new Error(t('That invite code is invalid or has expired. Ask for a new one.'));
      localStorage.removeItem(PENDING_INVITE_KEY);
      track('family_joined');
    });

  return (
    <Screen>
      <Text variant="display" style={{ marginTop: 48 }}>
        {t('Welcome')}
      </Text>
      {mode === 'create' ? (
        <>
          <Text color="textSecondary">{t('Tell us about your little one. You can change this later.')}</Text>
          <Field label={t("Baby's name")} value={name} onChangeText={setName} placeholder={t('e.g. Noah')} autoCapitalize="words" />
          <Text variant="label">{t('Birthday')}</Text>
          <Button variant="ghost" label={formatDate(birth.toISOString())} onPress={() => setPicking(true)} />
          {(picking || Platform.OS === 'ios') && (
            <DateTimePicker
              value={birth}
              mode="date"
              maximumDate={new Date()}
              onValueChange={(_, date) => {
                setPicking(false);
                setBirth(date);
              }}
              onDismiss={() => setPicking(false)}
            />
          )}
          {error && <Text color="textSecondary">{error}</Text>}
          <Button label={t('Start our journal')} onPress={create} disabled={!name.trim() || busy} />
          <Card>
            <Text color="textSecondary">{t('Someone already started a journal for your baby?')}</Text>
            <Button variant="ghost" label={t('Join with an invite code')} onPress={() => setMode('join')} />
          </Card>
        </>
      ) : (
        <>
          <Text color="textSecondary">{t('Paste the invite code a family member shared with you.')}</Text>
          <Field label={t('Invite code')} value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
          {error && <Text color="textSecondary">{error}</Text>}
          <Button label={t('Join family')} onPress={join} disabled={code.trim().length < 16 || busy} />
          <Button variant="ghost" label={t('Start a new journal instead')} onPress={() => setMode('create')} />
        </>
      )}
      <Button variant="ghost" label={t('Sign out')} onPress={() => signOut().catch(() => undefined)} />
    </Screen>
  );
}
