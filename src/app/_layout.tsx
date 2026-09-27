import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { AppProvider, useApp } from '@/state/app';

function RootStack() {
  const { status, refresh } = useApp();

  if (status === 'loading') return null;
  if (status === 'error') {
    return (
      <Screen>
        <Text variant="title">Can&apos;t reach Baby Journal</Text>
        <Text color="textSecondary">Check your connection. Your memories on this device are safe.</Text>
        <Button label="Try again" onPress={refresh} />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsBaby'}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="memory/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Back' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const theme = useTheme();
  const navTheme = dark ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: theme.background, card: theme.background, primary: theme.primary, text: theme.text, border: theme.border },
      }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppProvider>
        <RootStack />
      </AppProvider>
    </ThemeProvider>
  );
}
