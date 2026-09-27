import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { formatDate, localDayKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { PENDING_INVITE_KEY, useApp } from '@/state/app';

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
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
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
        const { data, error } = await supabase.rpc('create_family', { family_name: `${babyName}'s family` });
        if (error) throw error;
        familyId = data;
      }
      const { error } = await supabase
        .from('babies')
        .insert({ family_id: familyId, name: babyName, birth_date: localDayKey(birth) });
      if (error) throw error;
    });

  const join = () =>
    run(async () => {
      const { error } = await supabase.rpc('accept_invitation', { token: code.trim() });
      if (error?.message.includes('full')) throw new Error('This family has reached its member limit. Ask the owner to remove someone or upgrade.');
      if (error) throw new Error('That invite code is invalid or has expired. Ask for a new one.');
      localStorage.removeItem(PENDING_INVITE_KEY);
    });

  return (
    <Screen>
      <Text variant="display" style={{ marginTop: 48 }}>
        Welcome
      </Text>
      {mode === 'create' ? (
        <>
          <Text color="textSecondary">Tell us about your little one. You can change this later.</Text>
          <Field label="Baby's name" value={name} onChangeText={setName} placeholder="e.g. Noah" autoCapitalize="words" />
          <Text variant="label">Birthday</Text>
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
          <Button label="Start our journal" onPress={create} disabled={!name.trim() || busy} />
          <Card>
            <Text color="textSecondary">Someone already started a journal for your baby?</Text>
            <Button variant="ghost" label="Join with an invite code" onPress={() => setMode('join')} />
          </Card>
        </>
      ) : (
        <>
          <Text color="textSecondary">Paste the invite code a family member shared with you.</Text>
          <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
          {error && <Text color="textSecondary">{error}</Text>}
          <Button label="Join family" onPress={join} disabled={code.trim().length < 16 || busy} />
          <Button variant="ghost" label="Start a new journal instead" onPress={() => setMode('create')} />
        </>
      )}
      <Button variant="ghost" label="Sign out" onPress={() => signOut().catch(() => undefined)} />
    </Screen>
  );
}
