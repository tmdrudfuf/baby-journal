import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useApp, useBaby } from '@/state/app';

export default function FamilyScreen() {
  const baby = useBaby();
  const { session, signOut } = useApp();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Not yet', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="display">Family</Text>
      <Card>
        <Text variant="label">{baby.family_name}</Text>
        <Text color="textSecondary">Private by default. Inviting grandparents and caregivers is coming soon.</Text>
      </Card>
      <Card>
        <Text variant="caption" color="textSecondary">
          Signed in as {session?.user.email}
        </Text>
        <Button variant="ghost" label="Sign out" onPress={onSignOut} disabled={busy} />
      </Card>
    </Screen>
  );
}
