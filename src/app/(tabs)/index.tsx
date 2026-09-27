import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { DailyStory } from "@/components/daily-story";
import { MemoryImage } from "@/components/memory-image";
import { Button, Card, Screen, Text } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import {
  dayNumber,
  formatDate,
  formatTime,
  greeting,
  localDayKey,
  onThisDayLabel,
} from "@/lib/dates";
import { listEvents, listMemories, useLocal } from "@/lib/local-db";
import { describe, summarizeDay, summaryLine } from "@/lib/tracker";
import { atLeast, useBaby } from "@/state/app";

export default function HomeScreen() {
  const baby = useBaby();
  const memories = useLocal(() => listMemories(baby.id));
  const now = new Date();
  const todayKey = localDayKey(now);
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).toISOString();
  const events = useLocal(() => listEvents(baby.id, dayStart)).map((e) => ({
    ...e,
    data: JSON.parse(e.data) as Record<string, unknown>,
  }));
  const summary = summarizeDay(events, now, now);
  // TODAY mixes memories and tracker entries, oldest first like a diary page (§11).
  const todayMemories = memories.filter(
    (m) => localDayKey(new Date(m.occurred_at)) === todayKey,
  );
  const today = [
    ...todayMemories.map((m) => ({
      key: m.id,
      at: m.occurred_at,
      text: m.raw_text || "Photo",
      memoryId: m.id as string | null,
      photo: m.thumb_path || m.thumb_asset_id ? m : null,
    })),
    ...events
      .filter((e) => localDayKey(new Date(e.started_at)) === todayKey)
      .map((e) => ({
        key: e.id,
        at: e.started_at,
        text: describe(e, now),
        memoryId: null,
        photo: null,
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const hero = memories.find((m) => m.photo_path || m.display_asset_id);
  // The big photo is only the newest; the strip keeps the next few photo memories one tap away.
  const recent = memories
    .filter((m) => m.id !== hero?.id && (m.thumb_path || m.thumb_asset_id))
    .slice(0, 12);
  // ponytail: looks at memories on this device (newest 500); query the server when archives grow.
  const rediscovered = memories
    .map((m) => ({ m, label: onThisDayLabel(m.occurred_at, now) }))
    .filter((x): x is { m: typeof x.m; label: string } => x.label !== null);
  const day = baby.birth_date ? dayNumber(baby.birth_date, now) : null;

  return (
    <Screen>
      <Text variant="caption" color="textSecondary">
        {greeting(now)}
      </Text>
      <View>
        <Text variant="display">{baby.name}</Text>
        {day && day > 0 && <Text color="textSecondary">Day {day}</Text>}
      </View>

      {hero && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open latest photo"
          onPress={() => router.push(`/memory/${hero.id}`)}
        >
          <MemoryImage
            localUri={hero.photo_path}
            assetId={hero.display_asset_id}
            style={{
              width: "100%",
              aspectRatio: 4 / 5,
              borderRadius: Radius.lg,
            }}
          />
        </Pressable>
      )}
      {day && day > 0 && (
        <Text variant="title" style={{ textAlign: "center" }}>
          {day} {day === 1 ? "day" : "days"} together
        </Text>
      )}

      {recent.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="label">Recent moments</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: Spacing.sm }}
          >
            {recent.map((m) => (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`Memory from ${formatDate(m.occurred_at)}`}
                onPress={() => router.push(`/memory/${m.id}`)}
              >
                <MemoryImage
                  localUri={m.thumb_path}
                  assetId={m.thumb_asset_id}
                  style={{ width: 120, height: 120, borderRadius: Radius.md }}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {rediscovered.length > 0 && (
        <Card>
          <Text variant="caption" color="textSecondary">
            On this day ❤️
          </Text>
          {rediscovered.slice(0, 3).map(({ m, label }) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              onPress={() => router.push(`/memory/${m.id}`)}
              style={{ gap: Spacing.sm }}
            >
              {(m.photo_path || m.display_asset_id) && (
                <MemoryImage
                  localUri={m.photo_path}
                  assetId={m.display_asset_id}
                  style={{
                    width: "100%",
                    aspectRatio: 16 / 9,
                    borderRadius: Radius.md,
                  }}
                />
              )}
              <Text variant="label">{label}</Text>
              <Text color="textSecondary" numberOfLines={2}>
                {m.raw_text ?? formatDate(m.occurred_at)}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <Text variant="label">Today</Text>
        {(summary.feeds > 0 ||
          summary.diapers > 0 ||
          summary.sleepMinutes > 0 ||
          summary.sleeping) && (
          <Text variant="caption" color="textSecondary">
            {summaryLine(summary)}
            {summary.sleeping ? " · sleeping now" : ""}
          </Text>
        )}
        {today.length === 0 ? (
          <Text color="textSecondary">
            No moments yet today. Your first one takes about 10 seconds.
          </Text>
        ) : (
          <View style={{ gap: Spacing.xs }}>
            {today.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole={item.memoryId ? "button" : "text"}
                disabled={!item.memoryId}
                onPress={() =>
                  item.memoryId && router.push(`/memory/${item.memoryId}`)
                }
                style={{
                  flexDirection: "row",
                  gap: Spacing.md,
                  minHeight: 48,
                  alignItems: "center",
                }}
              >
                {item.photo ? (
                  <MemoryImage
                    localUri={item.photo.thumb_path}
                    assetId={item.photo.thumb_asset_id}
                    style={{ width: 48, height: 48, borderRadius: Radius.sm }}
                  />
                ) : null}
                <Text color="textSecondary">{formatTime(item.at)}</Text>
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {item.text}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
      <DailyStory
        babyId={baby.id}
        day={todayKey}
        moments={today.length}
        notes={
          todayMemories.filter((m) => (m.raw_text?.trim().length ?? 0) >= 3)
            .length
        }
        canEdit={atLeast(baby.role, "contributor")}
      />
      <Button
        label="Capture a moment"
        variant="accent"
        onPress={() => router.navigate("/capture")}
      />
    </Screen>
  );
}
