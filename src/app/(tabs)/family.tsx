import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Share, View } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { track } from '@/lib/analytics';
import { failedCount } from '@/lib/local-db';
import { getReminder, setReminder, type Reminder } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { atLeast, useApp, useBaby, type Role } from '@/state/app';
import { t, tn } from '@/lib/i18n';

type Member = { user_id: string; role: Role; profiles: { display_name: string | null } | null };

const roleLabel = (r: Role) =>
  ({ owner: t('Owner'), caregiver: t('Parent / caregiver'), contributor: t('Contributor'), viewer: t('Viewer') })[r];
const inviteLabel = (r: Role) =>
  ({ owner: '', caregiver: t('Invite a parent / caregiver'), contributor: t('Invite a contributor'), viewer: t('Invite a viewer') })[r];
const INVITABLE: Role[] = ['caregiver', 'contributor', 'viewer'];
const PRIVACY_URL = 'https://tmdrudfuf.github.io/baby-journal/privacy.html';
const planLabel = (id: string) => ({ free: t('Free'), plus: t('Plus'), family: t('Family') })[id] ?? id;
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
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  async function updateReminder(r: Reminder) {
    const ok = await setReminder(r);
    setReminderState(ok ? r : { ...r, enabled: false });
    if (!ok) setMessage(t('Notifications are off for Baby Journal. You can allow them in your phone settings.'));
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
        if (error) return setMessage(t('Could not load your family. Check your connection.'));
        setMembers(data as Member[]);
        setMyName((data as Member[]).find((m) => m.user_id === me)?.profiles?.display_name ?? '');
      });
    supabase.rpc('family_usage', { fid: baby.family_id }).then(({ data }) => setUsage(data?.[0] ?? null));
    supabase.from('families').select('ai_enabled').eq('id', baby.family_id).single().then(({ data }) => setAiEnabled(data?.ai_enabled ?? null));
  }, [baby.family_id, me]);

  // Tabs stay mounted; refresh whenever the tab is shown (someone may have joined).
  useFocusEffect(load);

  async function toggleAi() {
    const next = !aiEnabled;
    const { error } = await supabase.from('families').update({ ai_enabled: next }).eq('id', baby.family_id);
    if (error) return setMessage(t('Could not change AI suggestions. Check your connection.'));
    setAiEnabled(next);
  }

  async function saveName() {
    const { error } = await supabase.from('profiles').update({ display_name: myName.trim() || null }).eq('id', me ?? '');
    setMessage(error ? t('Could not save your name.') : t('Saved.'));
    load();
  }

  async function invite(role: Role) {
    setMessage(null);
    const { data: code, error } = await supabase.rpc('create_invitation', { fid: baby.family_id, invite_role: role });
    if (error) return setMessage(t('Could not create an invite. Check your connection.'));
    track('family_invited');
    await Share.share({
      message: t(
        "Join {name}'s private journal on Baby Journal as {role}.\n\n1. Install Baby Journal and create an account.\n2. Open this link on your phone: babyjournal://join?code={code}\n   or choose \"Join with an invite code\" and paste:\n\n{code}\n\nThe code works once and expires in 7 days.",
        { name: baby.name, role: roleLabel(role), code },
      ),
    });
  }

  // Android alerts show at most three buttons, so role changes are a second step.
  function manage(m: Member) {
    const name = m.profiles?.display_name || t('this member');
    Alert.alert(name, roleLabel(m.role), [
      { text: t('Change role'), onPress: () => pickRole(m, name) },
      { text: t('Remove from family'), style: 'destructive', onPress: () => update(m, { revoked_at: new Date().toISOString() }) },
      { text: t('Cancel'), style: 'cancel' },
    ]);
  }

  function pickRole(m: Member, name: string) {
    Alert.alert(
      t("Change {name}'s role", { name }),
      undefined,
      (['owner', ...INVITABLE] as Role[])
        .filter((r) => r !== m.role)
        .map((r) => ({ text: roleLabel(r), onPress: () => update(m, { role: r }) })),
      { cancelable: true },
    );
  }

  async function update(m: Member, patch: { role?: Role; revoked_at?: string }) {
    const { error } = await supabase.from('family_members').update(patch).eq('family_id', baby.family_id).eq('user_id', m.user_id);
    // The database refuses to leave a family without an owner.
    setMessage(error ? (error.code === '23514' ? t('A family needs at least one owner.') : t('Could not update this member.')) : null);
    load();
    if (m.user_id === me) refresh();
  }

  function onSignOut() {
    const failed = failedCount();
    if (!failed) return doSignOut();
    Alert.alert(
      t('Some items could not upload'),
      tn(
        failed,
        '{n} item could not be uploaded and will be removed from this phone when you sign out.',
        '{n} items could not be uploaded and will be removed from this phone when you sign out.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Sign out'), style: 'destructive', onPress: doSignOut },
      ],
    );
  }

  async function doSignOut() {
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert(t('Not yet'), e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  // Builds zips on the server (journal.json + readable index.html + up to 50 photos each); links work 24 h.
  // Larger journals come in parts: unzip all parts into one folder.
  async function exportData(part = 1) {
    setBusy(true);
    setMessage(part > 1 ? t('Preparing download part {part}… this can take a minute.', { part }) : t('Preparing download… this can take a minute.'));
    const { data, error } = await supabase.functions.invoke('media-sign', {
      body: { action: 'export', part, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    setBusy(false);
    if (error || !data?.url) return setMessage(t('Could not prepare your data. Check your connection and try again.'));
    setExportParts(data.parts);
    setMessage(
      data.parts > 1
        ? t('Part {part} of {parts} is ready. Download every part and unzip them into one folder.', { part: data.part, parts: data.parts })
        : t('Your download is ready. The link works for 24 hours.'),
    );
    Linking.openURL(data.url);
  }

  function confirmDeleteFamily() {
    Alert.alert(
      t('Delete {family}?', { family: baby.family_name }),
      t(
        "All of {name}'s memories, photos, logs and comments will be permanently deleted for everyone in the family. A Google Play subscription is not canceled by this; cancel it in Google Play.",
        { name: baby.name },
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Continue'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(t('This cannot be undone'), t('Delete the family and everything in it now?'), [
              { text: t('Keep it'), style: 'cancel' },
              { text: t('Delete forever'), style: 'destructive', onPress: deleteFamily },
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
      return setMessage(t('Could not delete the family. Check your connection and try again.'));
    }
    await supabase.functions.invoke('media-sign', { body: { action: 'purge' } }).catch(() => undefined);
    refresh(); // no family any more: back to onboarding, local copies are wiped
  }

  function confirmDeleteAccount() {
    Alert.alert(
      t('Delete your account?'),
      t('Your login is removed and you leave your family. Everyone else keeps the journal: if you are the only owner, ownership passes to the next parent or caregiver. A family with nobody else in it is deleted with all its memories and photos. Deleting your account does not cancel a Google Play subscription; cancel it in Google Play first.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Continue'),
          style: 'destructive',
          onPress: () =>
            Alert.alert(t('This cannot be undone'), t('Delete your account permanently?'), [
              { text: t('Keep my account'), style: 'cancel' },
              {
                text: t('Delete forever'),
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
      <Text variant="display">{t('Family')}</Text>
      <Card>
        <Text variant="label">{baby.family_name}</Text>
        <Text color="textSecondary">{t("Private by default. Only people you invite can see {name}'s journal.", { name: baby.name })}</Text>
        {usage && (
          <Text variant="caption" color="textSecondary">
            {t('{plan} plan · {used} of {total} used', { plan: planLabel(usage.plan_id), used: formatBytes(usage.used_bytes), total: formatBytes(usage.storage_bytes) })}
          </Text>
        )}
        <Button variant="ghost" label={t('Plans and storage')} onPress={() => router.push('/plans')} />
      </Card>

      <Card>
        <Text variant="label">{t('Members')}</Text>
        {members === null && <Text color="textSecondary">{t('Loading…')}</Text>}
        {members?.map((m) => (
          <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 }}>
            <View style={{ flex: 1 }}>
              <Text>
                {m.profiles?.display_name || t('No name yet')}
                {m.user_id === me ? t(' (you)') : ''}
              </Text>
              <Text variant="caption" color="textSecondary">
                {roleLabel(m.role)}
              </Text>
            </View>
            {isOwner && <Button variant="ghost" label={t('Manage')} onPress={() => manage(m)} />}
          </View>
        ))}
      </Card>

      {atLeast(baby.role, 'caregiver') && (
        <Card>
          <Text variant="label">{t('Invite someone')}</Text>
          <Text color="textSecondary">{t('Parents and caregivers can add memories. Viewers can see, react and comment.')}</Text>
          {INVITABLE.map((r) => (
            <Button key={r} variant="ghost" label={inviteLabel(r)} onPress={() => invite(r)} />
          ))}
        </Card>
      )}

      <Card>
        <Field label={t('Your name in this family')} value={myName} onChangeText={setMyName} placeholder={t('e.g. Dad, Grandma')} />
        <Button variant="ghost" label={t('Save name')} onPress={saveName} />
      </Card>
      <Card>
        <Text variant="label">{t('Gentle reminder')}</Text>
        <Text color="textSecondary">
          {reminder.enabled
            ? t('Every day at {time}, a quiet nudge to keep a moment.', { time: reminderTime })
            : t('Off. Turn on a quiet daily nudge if it helps.')}
        </Text>
        <Button
          variant="ghost"
          label={reminder.enabled ? t('Turn off') : t('Remind me at {time}', { time: reminderTime })}
          onPress={() => updateReminder({ ...reminder, enabled: !reminder.enabled })}
        />
        <Button variant="ghost" label={t('Change time')} onPress={() => setPickingTime(true)} />
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
          {t('Signed in as {email}', { email: session?.user.email ?? '' })}
        </Text>
        <Button variant="ghost" label={t('Sign out')} onPress={onSignOut} disabled={busy} />
      </Card>

      <Card>
        <Text variant="label">{t('Privacy')}</Text>
        <Text color="textSecondary">{t("Your family's memories are private. They are never sold or used for ads.")}</Text>
        <Button variant="ghost" label={t('Privacy policy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
        {aiEnabled !== null && (
          <>
            <Text color="textSecondary">
              {aiEnabled ? t('AI suggestions are on.') : t('AI suggestions are off.')}{' '}
              {t(
                "When on, the words of a new memory (never photos) are sent to our AI provider to suggest a journal entry and spot milestones; a Daily Story sends that day's notes, and asking your journal a question sends the few notes that match it. Your original words are always kept as written. Search itself works without sending anything outside our servers.",
              )}
            </Text>
            {isOwner && (
              <Button variant="ghost" label={aiEnabled ? t('Turn off AI suggestions') : t('Turn on AI suggestions')} onPress={toggleAi} disabled={busy} />
            )}
          </>
        )}
        <Button variant="ghost" label={t('Download my data')} onPress={() => exportData(1)} disabled={busy} />
        {exportParts > 1 &&
          Array.from({ length: exportParts - 1 }, (_, i) => i + 2).map((p) => (
            <Button key={p} variant="ghost" label={t('Download part {part} of {parts}', { part: p, parts: exportParts })} onPress={() => exportData(p)} disabled={busy} />
          ))}
        {isOwner && <Button variant="ghost" label={t('Delete this family')} onPress={confirmDeleteFamily} disabled={busy} />}
        <Button variant="ghost" label={t('Delete my account')} onPress={confirmDeleteAccount} disabled={busy} />
      </Card>
    </Screen>
  );
}
