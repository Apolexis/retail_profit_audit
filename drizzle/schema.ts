import { boolean, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const stores = mysqlTable("audit_stores", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  isHidden: boolean("isHidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const imports = mysqlTable("audit_imports", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  sourceYear: int("sourceYear").notNull(),
  status: mysqlEnum("status", ["preview", "completed", "failed"]).default("preview").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Passwords are stored only as application-encrypted values; they are never returned to the browser. */
export const importCredentialSettings = mysqlTable("audit_import_credential_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingsKey: varchar("settingsKey", { length: 32 }).notNull().unique(),
  openPasswordCiphertext: text("openPasswordCiphertext"),
  unprotectPasswordCiphertext: text("unprotectPasswordCiphertext"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Future-only import rule: selected monthly metric codes are materialized to daily facts when a new book is committed. */
export const importMaterializationSettings = mysqlTable("audit_import_materialization_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingsKey: varchar("settingsKey", { length: 32 }).notNull().unique(),
  metricCodes: json("metricCodes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const periods = mysqlTable("audit_periods", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  importId: int("importId"),
  monthDate: varchar("monthDate", { length: 7 }).notNull(),
  entryDate: varchar("entryDate", { length: 10 }).notNull().default("1970-01-01"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_period_store_entry_uq").on(table.storeId, table.entryDate)]);

export const metrics = mysqlTable("audit_metrics", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  metricCode: varchar("metricCode", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  isHidden: boolean("isHidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_metric_period_code_uq").on(table.periodId, table.metricCode)]);

/** Monthly budgets entered by administrators; the fact layer remains entirely separate. */
export const planFacts = mysqlTable("audit_plan_facts", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  monthDate: varchar("monthDate", { length: 7 }).notNull(),
  metricCode: varchar("metricCode", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_plan_fact_store_month_metric_uq").on(table.storeId, table.monthDate, table.metricCode)]);

export type AuditStore = typeof stores.$inferSelect;
export type AuditPeriod = typeof periods.$inferSelect;
export type AuditMetric = typeof metrics.$inferSelect;
export type AuditPlanFact = typeof planFacts.$inferSelect;
export type ImportCredentialSettings = typeof importCredentialSettings.$inferSelect;
export type ImportMaterializationSettings = typeof importMaterializationSettings.$inferSelect;

export const localAccounts = mysqlTable("audit_local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "analyst"]).default("analyst").notNull(),
  importAccessLevel: mysqlEnum("importAccessLevel", ["none", "upload", "edit"]).default("none").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
});

export const localSessions = mysqlTable("audit_local_sessions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Public-key credentials only: Face ID and other biometric templates never leave the device. */
export const localPasskeys = mysqlTable("audit_local_passkeys", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  credentialId: varchar("credentialId", { length: 512 }).notNull().unique(),
  publicKey: text("publicKey").notNull(),
  counter: int("counter").default(0).notNull(),
  transports: json("transports"),
  deviceType: varchar("deviceType", { length: 32 }).notNull(),
  backedUp: boolean("backedUp").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

/** Short-lived server-side ceremony state; consumed before passkey verification to prevent replay. */
export const localPasskeyChallenges = mysqlTable("audit_local_passkey_challenges", {
  id: int("id").autoincrement().primaryKey(),
  attemptHash: varchar("attemptHash", { length: 128 }).notNull().unique(),
  accountId: int("accountId").notNull(),
  ceremony: mysqlEnum("ceremony", ["registration", "authentication"]).notNull(),
  challenge: varchar("challenge", { length: 512 }).notNull(),
  origin: varchar("origin", { length: 512 }).notNull(),
  rpId: varchar("rpId", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditChangeLog = mysqlTable("audit_change_log", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId"),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 128 }).notNull(),
  beforeState: json("beforeState"),
  afterState: json("afterState"),
  rollbackOf: int("rollbackOf"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const storeAccess = mysqlTable("audit_store_access", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  storeId: int("storeId").notNull(),
  accessLevel: mysqlEnum("accessLevel", ["view", "edit"]).default("view").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("audit_store_access_account_store_uq").on(table.accountId, table.storeId)]);

export const auditNotifications = mysqlTable("audit_notifications", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).default("info").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditPushSubscriptions = mysqlTable("audit_push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull(),
  endpoint: text("endpoint").notNull(),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_push_subscription_endpoint_hash_uq").on(table.endpointHash)]);

/** Administrator-adjustable alert rules evaluated on the latest imported or edited facts. */
export const auditAlertThresholds = mysqlTable("audit_alert_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  ruleKey: varchar("ruleKey", { length: 64 }).notNull().unique(),
  metricCode: varchar("metricCode", { length: 64 }).notNull(),
  comparison: mysqlEnum("comparison", ["gte", "lte"]).notNull(),
  threshold: decimal("threshold", { precision: 18, scale: 2 }).notNull(),
  severity: mysqlEnum("severity", ["critical", "warning"]).default("warning").notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const executiveReportSchedules = mysqlTable("audit_executive_report_schedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }).unique(),
  weekday: int("weekday").notNull().default(1),
  reportTime: varchar("reportTime", { length: 5 }).notNull().default("09:00"),
  reportPeriod: varchar("reportPeriod", { length: 8 }).notNull().default("week"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const weeklyExecutiveReports = mysqlTable("audit_weekly_executive_reports", {
  id: int("id").autoincrement().primaryKey(),
  periodStart: varchar("periodStart", { length: 10 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 10 }).notNull(),
  snapshotMonth: varchar("snapshotMonth", { length: 7 }),
  summary: json("summary").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("audit_weekly_executive_report_period_uq").on(table.periodStart, table.periodEnd)]);

export type LocalAccount = typeof localAccounts.$inferSelect;
export type LocalSession = typeof localSessions.$inferSelect;
export type LocalPasskey = typeof localPasskeys.$inferSelect;
export type AuditChangeLog = typeof auditChangeLog.$inferSelect;
export type StoreAccess = typeof storeAccess.$inferSelect;
export type AuditNotification = typeof auditNotifications.$inferSelect;
export type AuditPushSubscription = typeof auditPushSubscriptions.$inferSelect;
export type AuditAlertThreshold = typeof auditAlertThresholds.$inferSelect;
export type ExecutiveReportSchedule = typeof executiveReportSchedules.$inferSelect;
export type WeeklyExecutiveReport = typeof weeklyExecutiveReports.$inferSelect;
