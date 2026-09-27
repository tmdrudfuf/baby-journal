import { Card, Screen, Text } from '@/components/ui';

export default function GrowthScreen() {
  return (
    <Screen>
      <Text variant="display">Growth</Text>
      <Card>
        <Text color="textSecondary">Feeding, sleep, diaper and growth logs will live here.</Text>
      </Card>
    </Screen>
  );
}
