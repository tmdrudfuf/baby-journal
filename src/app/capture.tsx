import { Card, Screen, Text } from '@/components/ui';

export default function CaptureScreen() {
  return (
    <Screen>
      <Text variant="display">Capture</Text>
      <Card>
        <Text color="textSecondary">Photo, video, voice or a few words. Capture first, sort it out later.</Text>
      </Card>
    </Screen>
  );
}
