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

export const periods = mysqlTable("audit_periods", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  importId: int("importId"),
  monthDate: varchar("monthDate", { length: 7 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_period_store_month_uq").on(table.storeId, table.monthDate)]);

export const metrics = mysqlTable("audit_metrics", {
  id: int("id").autoincrement().primaryKey(),
  periodId: int("periodId").notNull(),
  metricCode: varchar("metricCode", { length: 64 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_metric_period_code_uq").on(table.periodId, table.metricCode)]);

export type AuditStore = typeof stores.$inferSelect;
export type AuditPeriod = typeof periods.$inferSelect;
export type AuditMetric = typeof metrics.$inferSelect;

export const localAccounts = mysqlTable("audit_local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "analyst"]).default("analyst").notNull(),
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

export type LocalAccount = typeof localAccounts.$inferSelect;
export type LocalSession = typeof localSessions.$inferSelect;
export type AuditChangeLog = typeof auditChangeLog.$inferSelect;
export type StoreAccess = typeof storeAccess.$inferSelect;
export type AuditNotification = typeof auditNotifications.$inferSelect;
