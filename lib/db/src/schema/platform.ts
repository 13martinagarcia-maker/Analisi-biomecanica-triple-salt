import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const usersTable = pgTable("ts_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

export const sessionsTable = pgTable("ts_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const athletesTable = pgTable("ts_athletes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  goals: text("goals"),
  technicalNotes: text("technical_notes"),
  ...timestamps,
});

export const competitionsTable = pgTable("ts_competitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  athleteId: uuid("athlete_id").references(() => athletesTable.id, { onDelete: "set null" }),
  location: text("location").notNull(),
  eventDate: date("event_date").notNull(),
  objective: text("objective").notNull(),
  personalBest: numeric("personal_best", { precision: 6, scale: 2 }),
  seasonGoal: numeric("season_goal", { precision: 6, scale: 2 }),
  achieved: boolean("achieved"),
  resultNote: text("result_note"),
  ...timestamps,
});

export const jumpsTable = pgTable("ts_jumps", {
  id: uuid("id").defaultRandom().primaryKey(),
  competitionId: uuid("competition_id").notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  jumpNumber: integer("jump_number").notNull(),
  mark: numeric("mark", { precision: 6, scale: 2 }),
  isFoul: boolean("is_foul").default(false).notNull(),
}, (table) => ({
  competitionJumpUnique: unique("ts_competition_jump_unique").on(table.competitionId, table.jumpNumber),
}));

export const trackEvaluationsTable = pgTable("ts_track_evaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  athleteId: uuid("athlete_id").references(() => athletesTable.id, { onDelete: "set null" }),
  competitionId: uuid("competition_id").references(() => competitionsTable.id, { onDelete: "set null" }),
  approachScore: numeric("approach_score", { precision: 4, scale: 2 }).notNull(),
  rhythmScore: numeric("rhythm_score", { precision: 4, scale: 2 }).notNull(),
  landingScore: numeric("landing_score", { precision: 4, scale: 2 }).notNull(),
  approachAnswer: text("approach_answer").notNull(),
  rhythmAnswer: text("rhythm_answer").notNull(),
  landingAnswer: text("landing_answer").notNull(),
  finalScore: numeric("final_score", { precision: 4, scale: 2 }),
  assessmentData: jsonb("assessment_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});