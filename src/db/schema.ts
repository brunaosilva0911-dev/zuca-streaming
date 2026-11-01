import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** A ZUCA viewer profile (multi-profile home, like a premium streaming app). */
export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    avatarSeed: text("avatar_seed").notNull().default("zuca"),
    pin: text("pin"),
    isKids: boolean("is_kids").notNull().default(false),
    preferredCategories: jsonb("preferred_categories")
      .$type<number[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("profiles_name_uidx").on(table.name)],
);

/** Channels pinned as favorites by a profile. */
export const favorites = pgTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    channelName: text("channel_name").notNull(),
    logo: text("logo").notNull().default(""),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("favorites_profile_channel_uidx").on(
      table.profileId,
      table.channelId,
    ),
    index("favorites_profile_idx").on(table.profileId),
  ],
);

/** "Continuar assistindo" — watch progress per channel per profile. */
export const watchHistory = pgTable(
  "watch_history",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    channelName: text("channel_name").notNull(),
    logo: text("logo").notNull().default(""),
    secondsWatched: integer("seconds_watched").notNull().default(0),
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("watch_history_profile_channel_uidx").on(
      table.profileId,
      table.channelId,
    ),
    index("watch_history_profile_idx").on(table.profileId),
  ],
);

/** Server-side snapshot of the provider catalog (SFW-filtered) for analytics. */
export const catalogSnapshots = pgTable("catalog_snapshots", {
  id: text("id").primaryKey(),
  totalChannels: integer("total_channels").notNull().default(0),
  blockedChannels: integer("blocked_channels").notNull().default(0),
  totalEvents: integer("total_events").notNull().default(0),
  capturedAt: timestamp("captured_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type FavoriteRow = typeof favorites.$inferSelect;
export type WatchHistoryRow = typeof watchHistory.$inferSelect;
