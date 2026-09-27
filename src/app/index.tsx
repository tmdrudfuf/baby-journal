import { Button, Card, Screen, Text } from '@/components/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <Text variant="caption" color="textSecondary">
        Welcome
      </Text>
      <Text variant="display">Your baby&apos;s story</Text>
      <Card>
        <Text variant="label">Today</Text>
        <Text color="textSecondary">No moments yet. Your first memory takes about 10 seconds.</Text>
      </Card>
      <Button label="Capture a moment" variant="accent" />
    </Screen>
  );
}
