import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  archivedAt: text("archived_at"),
}, (table) => [
  uniqueIndex("idx_emp_norm").on(table.nameNormalized),
]);

export const workLocations = sqliteTable("work_locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const firms = sqliteTable("firms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  archivedAt: text("archived_at"),
});

export const points = sqliteTable("points", {
  id: text("id").primaryKey(),
  firmId: text("firm_id").notNull().references(() => firms.id),
  parentPointId: text("parent_point_id"), // NULL = nodal point; references points.id
  name: text("name").notNull(),
  nameNormalized: text("name_normalized").notNull(),
  shiftDurationHours: integer("shift_duration_hours"), // 8 or 12, set on nodal points only
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  pointId: text("point_id").notNull().references(() => points.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const extractions = sqliteTable("extractions", {
  id: text("id").primaryKey(),
  r2Key: text("r2_key").notNull().unique(),
  workDate: text("work_date").notNull(),
  aiModel: text("ai_model").notNull(),
  rawResponse: text("raw_response").notNull(),
  status: text("status", { enum: ["processing", "pending", "committed", "discarded", "failed"] }).notNull().default("processing"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  committedAt: text("committed_at"),
});

export const extractionRows = sqliteTable("extraction_rows", {
  id: text("id").primaryKey(),
  extractionId: text("extraction_id").notNull().references(() => extractions.id),
  rowNum: integer("row_num"),
  nameRaw: text("name_raw"),
  locationRaw: text("location_raw"),
  matchedEmployeeId: text("matched_employee_id").references(() => employees.id),
  matchedLocationId: text("matched_location_id").references(() => workLocations.id),
  matchConfidence: real("match_confidence"),
  userAction: text("user_action"),
  matchedPointId: text("matched_point_id").references(() => points.id),
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  locationId: text("location_id").references(() => workLocations.id),
  pointId: text("point_id").references(() => points.id),
  shiftId: text("shift_id").references(() => shifts.id),
  workDate: text("work_date").notNull(),
  extractionId: text("extraction_id").references(() => extractions.id),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("idx_attendance_unique").on(table.employeeId, table.workDate),
]);
