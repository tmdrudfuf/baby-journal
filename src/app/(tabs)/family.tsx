import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Share, View } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { failedCount } from '@/lib/local-db';
import { getReminder, setReminder, type Reminder } from '@/lib/reminders';
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
const PLAN_LABEL: Record<string, string> = { free: 'Free', plus: 'Plus', family: 'Family' };
const formatBytes = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(b % 1024 ** 3 ? 1 : 0)} GB` : `${Math.max(0.1, b / 1024 ** 2).toFixed(1)} MB`;

export default function FamilyScreen() {
  const baby = useBaby();
  const { session, signOut, refresh, deleteAccount } = useApp();
  const me = session?.user.id;
  const [members, setMembers] = useState<Member[] | null>(null);
  const [usage, setUsage] = useState<{ plan_id: string; used_bytes: number; storage_bytes: number } | null>(null);
  const [myName, setMyName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reminder, setReminderState] = useState<Reminder>(getReminder);
  const [pickingTime, setPickingTime] = useState(false);
  const [exportParts, setExportParts] = useState(0);

  async function updateReminder(r: Reminder) {
    const ok = await setReminder(r);
    setReminderState(ok ? r : { ...r, enabled: false });
    if (!ok) setMessage('Notifications are off for Baby Journal. You can allow them in your phone settings.');
  }
  const reminderTime = new Date(2000, 0, 1, reminder.hour, reminder.minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

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
    supabase.rpc('family_usage', { fid: baby.family_id }).then(({ data }) => setUsage(data?.[0] ?? null));
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
        `1. Install Baby Journal and create an account.\n` +
        `2. Open this link on your phone: babyjournal://join?code=${code}\n` +
        `   or choose "Join with an invite code" and paste:\n\n${code}\n\n` +
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

  function onSignOut() {
    const failed = failedCount();
    if (!failed) return doSignOut();
    Alert.alert(
      'Some items could not upload',
      `${failed} ${failed === 1 ? 'item' : 'items'} could not be uploaded and will be removed from this phone when you sign out.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: doSignOut },
      ],
    );
  }

  async function doSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Not yet', e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  // Builds zips on the server (journal.json + readable index.html + up to 50 photos each); links work 24 h.
  // Larger journals come in parts: unzip all parts into one folder.
  async function exportData(part = 1) {
    setBusy(true);
    setMessage(`Preparing download${part > 1 ? ` part ${part}` : ''}… this can take a minute.`);
    const { data, error } = await supabase.functions.invoke('media-sign', {
      body: { action: 'export', part, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    setBusy(false);
    if (error || !data?.url) return setMessage('Could not prepare your data. Check your connection and try again.');
    setExportParts(data.parts);
    setMessage(
      data.parts > 1
        ? `Part ${data.part} of ${data.parts} is ready. Download every part and unzip them into one folder.`
        : 'Your download is ready. The link works for 24 hours.',
    );
    Linking.openURL(data.url);
  }

  function confirmDeleteFamily() {
    Alert.alert(
      `Delete ${baby.family_name}?`,
      `All of ${baby.name}'s memories, photos, logs and comments will be permanently deleted for everyone in the family.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('This cannot be undone', 'Delete the family and everything in it now?', [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Delete forever', style: 'destructive', onPress: deleteFamily },
            ]),
        },
      ],
    );
  }

  async function deleteFamily() {
    setBusy(true);
    const { error } = await supabase.from('families').delete().eq('id', baby.family_id);
    if (error) {
      setBusy(false);
      return setMessage('Could not delete the family. Check your connection and try again.');
    }
    await supabase.functions.invoke('media-sign', { body: { action: 'purge' } }).catch(() => undefined);
    refresh(); // no family any more: back to onboarding, local copies are wiped
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'Your login is removed and you leave your family. Everyone else keeps the journal: if you are the only owner, ownership passes to the next parent or caregiver. A family with nobody else in it is deleted with all its memories and photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('This cannot be undone', 'Delete your account permanently?', [
              { text: 'Keep my account', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: () => {
                  setBusy(true);
                  deleteAccount().catch((e: Error) => {
                    setBusy(false);
                    setMessage(e.message);
                  });
                },
              },
            ]),
        },
      ],
    );
  }

  const isOwner = baby.role === 'owner';

  return (
    <Screen>
      <Text variant="display">Family</Text>
      <Card>
        <Text variant="label">{baby.family_name}</Text>
        <Text color="textSecondary">Private by default. Only people you invite can see {baby.name}&apos;s journal.</Text>
        {usage && (
          <Text variant="caption" color="textSecondary">
            {PLAN_LABEL[usage.plan_id] ?? usage.plan_id} plan · {formatBytes(usage.used_bytes)} of {formatBytes(usage.storage_bytes)} used
          </Text>
        )}
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
      <Card>
        <Text variant="label">Gentle reminder</Text>
        <Text color="textSecondary">
          {reminder.enabled ? `Every day at ${reminderTime}, a quiet nudge to keep a moment.` : 'Off. Turn on a quiet daily nudge if it helps.'}
        </Text>
        <Button
          variant="ghost"
          label={reminder.enabled ? 'Turn off' : `Remind me at ${reminderTime}`}
          onPress={() => updateReminder({ ...reminder, enabled: !reminder.enabled })}
        />
        <Button variant="ghost" label="Change time" onPress={() => setPickingTime(true)} />
        {pickingTime && (
          <DateTimePicker
            value={new Date(2000, 0, 1, reminder.hour, reminder.minute)}
            mode="time"
            onValueChange={(_, d) => {
              setPickingTime(false);
              updateReminder({ enabled: true, hour: d.getHours(), minute: d.getMinutes() });
            }}
            onDismiss={() => setPickingTime(false)}
          />
        )}
      </Card>
      {message && <Text color="textSecondary">{message}</Text>}

      <Card>
        <Text variant="caption" color="textSecondary">
          Signed in as {session?.user.email}
        </Text>
        <Button variant="ghost" label="Sign out" onPress={onSignOut} disabled={busy} />
      </Card>

      <Card>
        <Text variant="label">Privacy</Text>
        <Text color="textSecondary">Your family&apos;s memories are private. They are never sold or used for ads.</Text>
        <Button variant="ghost" label="Download my data" onPress={() => exportData(1)} disabled={busy} />
        {exportParts > 1 &&
          Array.from({ length: exportParts - 1 }, (_, i) => i + 2).map((p) => (
            <Button key={p} variant="ghost" label={`Download part ${p} of ${exportParts}`} onPress={() => exportData(p)} disabled={busy} />
          ))}
        {isOwner && <Button variant="ghost" label="Delete this family" onPress={confirmDeleteFamily} disabled={busy} />}
        <Button variant="ghost" label="Delete my account" onPress={confirmDeleteAccount} disabled={busy} />
      </Card>
    </Screen>
  );
}
