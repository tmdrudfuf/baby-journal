import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Field, Screen, Text } from '@/components/ui';
import { formatDate, localDayKey } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/state/app';

export default function OnboardingScreen() {
  const { setBaby, signOut } = useApp();
  const [name, setName] = useState('');
  const [birth, setBirth] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const babyName = name.trim();
      // Reuse a family from an earlier attempt instead of creating a duplicate.
      const { data: existing } = await supabase.from('families').select('id, name').limit(1);
      let family = existing?.[0];
      if (!family) {
        const familyName = `${babyName}'s family`;
        const { data: id, error: e } = await supabase.rpc('create_family', { family_name: familyName });
        if (e) throw e;
        family = { id, name: familyName };
      }
      const { data: baby, error: e2 } = await supabase
        .from('babies')
        .insert({ family_id: family.id, name: babyName, birth_date: localDayKey(birth) })
        .select('id, family_id, name, birth_date')
        .single();
      if (e2) throw e2;
      setBaby({ ...baby, family_name: family.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="display" style={{ marginTop: 48 }}>
        Welcome
      </Text>
      <Text color="textSecondary">Tell us about your little one. You can change this later.</Text>
      <Field label="Baby's name" value={name} onChangeText={setName} placeholder="e.g. Noah" autoCapitalize="words" />
      <Text variant="label">Birthday</Text>
      <Button variant="ghost" label={formatDate(birth.toISOString())} onPress={() => setPicking(true)} />
      {(picking || Platform.OS === 'ios') && (
        <DateTimePicker
          value={birth}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, date) => {
            setPicking(false);
            if (date) setBirth(date);
          }}
        />
      )}
      {error && <Text color="textSecondary">{error}</Text>}
      <Button label="Start our journal" onPress={submit} disabled={!name.trim() || busy} />
      <Button variant="ghost" label="Sign out" onPress={() => signOut().catch(() => undefined)} />
    </Screen>
  );
}
