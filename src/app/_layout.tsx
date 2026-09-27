import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useColorScheme, View } from 'react-native';

import { Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'journal', title: 'Journal', icon: 'book-outline' },
  { name: 'capture', title: 'Capture', icon: 'add' },
  { name: 'growth', title: 'Growth', icon: 'leaf-outline' },
  { name: 'family', title: 'Family', icon: 'people-outline' },
];

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
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: 72 },
          tabBarLabelStyle: { fontSize: 12 },
        }}>
        {tabs.map(({ name, title, icon }) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarAccessibilityLabel: title,
              tabBarIcon: ({ color, size }) =>
                name === 'capture' ? (
                  // Capture is visually emphasized (§10).
                  <View
                    style={{
                      width: TouchTarget,
                      height: TouchTarget,
                      marginTop: -20,
                      borderRadius: Radius.pill,
                      backgroundColor: theme.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name={icon} size={32} color={theme.onAccent} />
                  </View>
                ) : (
                  <Ionicons name={icon} size={size} color={color} />
                ),
            }}
          />
        ))}
      </Tabs>
    </ThemeProvider>
  );
}
