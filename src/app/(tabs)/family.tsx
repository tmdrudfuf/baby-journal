import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, View } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { atLeast, useApp, useBaby, type Role } from '@/state/app';

type Member = { user_id: string; role: Role; profiles: { display_name: string | null } | null };

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  caregiver: 'Parent / caregiver',
  contributor: 'Contributor',
  viewer: 'Viewer',
};
const INVITABLE: Role[] = ['caregiver', 'contributor', 'viewer'];

export default function FamilyScreen() {
  const baby = useBaby();
  const { session, signOut, refresh } = useApp();
  const me = session?.user.id;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [myName, setMyName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    supabase
      .from('family_members')
      .select('user_id, role, profiles(display_name)')
      .eq('family_id', baby.family_id)
      .is('revoked_at', null)
      .order('created_at')
      .then(({ data, error }) => {
        if (error) return setMessage('Could not load your family. Check your connection.');
        setMembers(data as Member[]);
        setMyName((data as Member[]).find((m) => m.user_id === me)?.profiles?.display_name ?? '');
      });
  }, [baby.family_id, me]);

  // Tabs stay mounted; refresh whenever the tab is shown (someone may have joined).
  useFocusEffect(load);

  async function saveName() {
    const { error } = await supabase.from('profiles').update({ display_name: myName.trim() || null }).eq('id', me ?? '');
    setMessage(error ? 'Could not save your name.' : 'Saved.');
    load();
  }

  async function invite(role: Role) {
    setMessage(null);
    const { data: code, error } = await supabase.rpc('create_invitation', { fid: baby.family_id, invite_role: role });
    if (error) return setMessage('Could not create an invite. Check your connection.');
    await Share.share({
      message:
        `Join ${baby.name}'s private journal on Baby Journal as ${ROLE_LABEL[role].toLowerCase()}.\n\n` +
        `1. Install Baby Journal and create an account.\n2. Choose "Join with an invite code" and paste:\n\n${code}\n\n` +
        `The code works once and expires in 7 days.`,
    });
  }

  // Android alerts show at most three buttons, so role changes are a second step.
  function manage(m: Member) {
    const name = m.profiles?.display_name || 'this member';
    Alert.alert(name, ROLE_LABEL[m.role], [
      { text: 'Change role', onPress: () => pickRole(m, name) },
      { text: 'Remove from family', style: 'destructive', onPress: () => update(m, { revoked_at: new Date().toISOString() }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function pickRole(m: Member, name: string) {
    Alert.alert(
      `Change ${name}'s role`,
      undefined,
      (['owner', ...INVITABLE] as Role[])
        .filter((r) => r !== m.role)
        .map((r) => ({ text: ROLE_LABEL[r], onPress: () => update(m, { role: r }) })),
      { cancelable: true },
    );
  }

  async function update(m: Member, patch: { role?: Role; revoked_at?: string }) {
    const { error } = await supabase.from('family_members').update(patch).eq('family_id', baby.family_id).eq('user_id', m.user_id);
    // The database refuses to leave a family without an owner.
    setMessage(error ? (error.code === '23514' ? 'A family needs at least one owner.' : 'Could not update this member.') : null);
    load();
    if (m.user_id === me) refresh();
  }

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Not yet', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const isOwner = baby.role === 'owner';

  return (
    <Screen>
      <Text variant="display">Family</Text>
      <Card>
        <Text variant="label">{baby.family_name}</Text>
        <Text color="textSecondary">Private by default. Only people you invite can see {baby.name}&apos;s journal.</Text>
      </Card>

      <Card>
        <Text variant="label">Members</Text>
        {members === null && <Text color="textSecondary">Loading…</Text>}
        {members?.map((m) => (
          <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 }}>
            <View style={{ flex: 1 }}>
              <Text>
                {m.profiles?.display_name || 'No name yet'}
                {m.user_id === me ? ' (you)' : ''}
              </Text>
              <Text variant="caption" color="textSecondary">
                {ROLE_LABEL[m.role]}
              </Text>
            </View>
            {isOwner && <Button variant="ghost" label="Manage" onPress={() => manage(m)} />}
          </View>
        ))}
      </Card>

      {atLeast(baby.role, 'caregiver') && (
        <Card>
          <Text variant="label">Invite someone</Text>
          <Text color="textSecondary">Parents and caregivers can add memories. Viewers can see, react and comment.</Text>
          {INVITABLE.map((r) => (
            <Button key={r} variant="ghost" label={`Invite a ${ROLE_LABEL[r].toLowerCase()}`} onPress={() => invite(r)} />
          ))}
        </Card>
      )}

      <Card>
        <Field label="Your name in this family" value={myName} onChangeText={setMyName} placeholder="e.g. Dad, Grandma" />
        <Button variant="ghost" label="Save name" onPress={saveName} />
      </Card>
      {message && <Text color="textSecondary">{message}</Text>}

      <Card>
        <Text variant="caption" color="textSecondary">
          Signed in as {session?.user.email}
        </Text>
        <Button variant="ghost" label="Sign out" onPress={onSignOut} disabled={busy} />
      </Card>
    </Screen>
  );
}
