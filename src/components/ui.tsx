// Core UI primitives. Keep this small; split files only when one grows.
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps as RNTextProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing, TouchTarget, Type, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextProps = RNTextProps & {
  variant?: keyof typeof Type;
  color?: keyof ThemeColors;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  const theme = useTheme();
  return <RNText style={[Type[variant], { color: theme[color] }, style]} {...rest} />;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  // Bottom padding clears the raised Capture tab button.
  const content = <View style={{ padding: Spacing.lg, paddingBottom: Spacing.xxl * 2, gap: Spacing.md }}>{children}</View>;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      {scroll ? <ScrollView>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[{ backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm }, style]}
      {...rest}
    />
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'accent' | 'ghost' | 'chip';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : variant === 'accent' ? theme.accent : variant === 'chip' ? theme.background : 'transparent';
  const chip = variant === 'chip';
  const fg = variant === 'primary' ? 'onPrimary' : variant === 'accent' ? 'onAccent' : 'link';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: chip ? 48 : TouchTarget,
        borderRadius: Radius.pill,
        paddingHorizontal: chip ? Spacing.md : Spacing.lg,
        borderWidth: chip ? 1 : 0,
        borderColor: theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}>
      <Text variant="label" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

// Secondary actions side by side (wraps on narrow screens) instead of a tall stack of buttons.
export function Actions({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>{children}</View>;
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          Type.body,
          {
            minHeight: TouchTarget,
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
