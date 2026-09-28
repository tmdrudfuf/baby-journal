import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LocalMemory } from '@/lib/local-db';
import { t } from '@/lib/i18n';

// Works for anything in the upload queue (memories, tracker events).
export function SyncBadge({ memory }: { memory: Pick<LocalMemory, 'status' | 'attempts' | 'last_error'> }) {
  const theme = useTheme();
  if (memory.status === 'synced') return null;
  // Icon + words, never color alone (§24).
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
      <Ionicons name={memory.status === 'failed' ? 'alert-circle-outline' : 'cloud-upload-outline'} size={16} color={theme.textSecondary} />
      <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
        {memory.status === 'failed'
          ? /quota/i.test(memory.last_error ?? '')
            ? t('Family storage is full. Kept on this phone.')
            : t("Couldn't upload ({reason}). Kept on this phone.", { reason: t(memory.last_error ?? 'not allowed') })
          : memory.attempts > 0
            ? t('Will upload when online')
            : t('Uploading…')}
      </Text>
    </View>
  );
}
