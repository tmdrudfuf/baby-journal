import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LocalMemory } from '@/lib/local-db';

// Works for anything in the upload queue (memories, tracker events).
export function SyncBadge({ memory }: { memory: Pick<LocalMemory, 'status' | 'attempts'> }) {
  const theme = useTheme();
  if (memory.status === 'synced') return null;
  // Icon + words, never color alone (§24).
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
      <Ionicons name="cloud-upload-outline" size={16} color={theme.textSecondary} />
      <Text variant="caption" color="textSecondary">
        {memory.attempts > 0 ? 'Will upload when online' : 'Uploading…'}
      </Text>
    </View>
  );
}
