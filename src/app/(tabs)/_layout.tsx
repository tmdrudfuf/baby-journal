import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

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

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.link,
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
  );
}
