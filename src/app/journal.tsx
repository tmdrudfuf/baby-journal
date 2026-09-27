import { Card, Screen, Text } from '@/components/ui';

export default function JournalScreen() {
  return (
    <Screen>
      <Text variant="display">Journal</Text>
      <Card>
        <Text color="textSecondary">Your memories will appear here, newest first.</Text>
      </Card>
    </Screen>
  );
}
