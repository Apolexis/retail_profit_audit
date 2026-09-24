import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

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
  /** Short reward text is meaningful only for the monthly Evotor revenue plan. */
  rewardText: varchar("rewardText", { length: 280 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("audit_plan_fact_store_month_metric_uq").on(table.storeId, table.monthDate, table.metricCode)]);

/**
 * A durable de-duplication ledger for in-app milestones of the separate
 * Evotor sales plan. It contains neither receipts nor payment data: only the
 * percentage milestone that was actually crossed for one store and month.
 */
export const operationalEvotorRevenuePlanMilestones = mysqlTable("operational_evotor_revenue_plan_milestones", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  monthDate: varchar("monthDate", { length: 7 }).notNull(),
  milestonePercent: int("milestonePercent").notNull(),
  planAmount: decimal("planAmount", { precision: 18, scale: 2 }).notNull(),
  actualAmount: decimal("actualAmount", { precision: 18, scale: 2 }).notNull(),
  notifiedAt: timestamp("notifiedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_evotor_revenue_plan_milestone_uq").on(table.storeId, table.monthDate, table.milestonePercent)]);

export type AuditStore = typeof stores.$inferSelect;
export type AuditPeriod = typeof periods.$inferSelect;
export type AuditMetric = typeof metrics.$inferSelect;
export type AuditPlanFact = typeof planFacts.$inferSelect;
export type OperationalEvotorRevenuePlanMilestone = typeof operationalEvotorRevenuePlanMilestones.$inferSelect;
export type ImportCredentialSettings = typeof importCredentialSettings.$inferSelect;
export type ImportMaterializationSettings = typeof importMaterializationSettings.$inferSelect;

export const localAccounts = mysqlTable("audit_local_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  firstName: varchar("firstName", { length: 64 }),
  lastName: varchar("lastName", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "analyst", "seller", "manager"]).default("analyst").notNull(),
  importAccessLevel: mysqlEnum("importAccessLevel", ["none", "upload", "edit"]).default("none").notNull(),
  priceAccessLevel: mysqlEnum("priceAccessLevel", ["none", "view", "upload", "edit"]).default("none").notNull(),
  canViewImportControls: boolean("canViewImportControls").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
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

/** Human-confirmed Evotor store mapping; API UUIDs remain optional until read-only discovery. */
export const operationalStoreMappings = mysqlTable("operational_store_mappings", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().unique(),
  evotorStoreName: varchar("evotorStoreName", { length: 255 }).notNull(),
  evotorAddress: varchar("evotorAddress", { length: 512 }).notNull(),
  evotorTerminalUuid: varchar("evotorTerminalUuid", { length: 128 }),
  configuredByAccountId: int("configuredByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Non-secret identifier of the terminal app that is allowed to receive Evotor push payloads. */
export const operationalEvotorPushSettings = mysqlTable("operational_evotor_push_settings", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 128 }).notNull().unique(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditNotifications = mysqlTable("audit_notifications", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId"),
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).default("info").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  isRead: boolean("isRead").default(false).notNull(),
  /** System-set when the operational condition is later satisfied. */
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("audit_notification_entity_resolution_idx").on(table.entityType, table.entityId, table.resolvedAt)]);

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

/**
 * Separate operational daily registry. It deliberately has no relation to
 * audit_metrics or audit_imports: its total is not a financial fact.
 */
export const operationalRevenueRecords = mysqlTable("operational_revenue_records", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  isVoided: boolean("isVoided").default(false).notNull(),
  voidReason: text("voidReason"),
  voidedByAccountId: int("voidedByAccountId"),
  voidedAt: timestamp("voidedAt"),
  cash: decimal("cash", { precision: 18, scale: 2 }).notNull(),
  cashless: decimal("cashless", { precision: 18, scale: 2 }).notNull(),
  cashExpenses: decimal("cashExpenses", { precision: 18, scale: 2 }).notNull(),
  householdCash: decimal("householdCash", { precision: 18, scale: 2 }).notNull(),
  cleaningCash: decimal("cleaningCash", { precision: 18, scale: 2 }).notNull(),
  salaryCash: decimal("salaryCash", { precision: 18, scale: 2 }).notNull(),
  serviceCash: decimal("serviceCash", { precision: 18, scale: 2 }).notNull(),
  extraPaymentCash: decimal("extraPaymentCash", { precision: 18, scale: 2 }).notNull(),
  bonusCash: decimal("bonusCash", { precision: 18, scale: 2 }).notNull(),
  vacationCash: decimal("vacationCash", { precision: 18, scale: 2 }).notNull(),
  utilitiesCash: decimal("utilitiesCash", { precision: 18, scale: 2 }).notNull(),
  deliveryCash: decimal("deliveryCash", { precision: 18, scale: 2 }).notNull(),
  expenseComments: json("expenseComments").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_revenue_store_date_uq").on(table.storeId, table.businessDate)]);

/** Immutable snapshots make an administrative correction auditable without deleting the original. */
export const operationalRevenueRecordVersions = mysqlTable("operational_revenue_record_versions", {
  id: int("id").autoincrement().primaryKey(),
  revenueRecordId: int("revenueRecordId").notNull(),
  version: int("version").notNull(),
  action: mysqlEnum("action", ["create", "correct", "void", "recreate"]).notNull(),
  changedByAccountId: int("changedByAccountId").notNull(),
  correctionReason: text("correctionReason"),
  state: json("state").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_revenue_version_uq").on(table.revenueRecordId, table.version)]);

export type OperationalRevenueRecord = typeof operationalRevenueRecords.$inferSelect;
export type OperationalRevenueRecordVersion = typeof operationalRevenueRecordVersions.$inferSelect;

/**
 * This register is separate from the financial workbook and the old analytical
 * "Остатки" page. A draft becomes immutable after a manager closes it.
 */
export const operationalInventories = mysqlTable("operational_inventories", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["draft", "closed"]).default("draft").notNull(),
  /** Archived closed recounts stay immutable for audit and stock movements, but leave the working history. */
  isArchived: boolean("isArchived").default(false).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  closedByAccountId: int("closedByAccountId"),
  closedAt: timestamp("closedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_inventory_store_date_uq").on(table.storeId, table.businessDate)]);

/**
 * Working store nomenclature. It is intentionally separate from price-control products,
 * financial imports and Evotor itself. Every mutable value is audited at the router level.
 */
export const operationalCatalogProducts = mysqlTable("operational_catalog_products", {
  id: int("id").autoincrement().primaryKey(),
  /** Business identifier: a human-visible sequence, future Evotor article and 1C matching key. Database primary key stays internal. */
  catalogNumber: int("catalogNumber").notNull().unique(),
  /** Historic source point for an initial read-only import; global manual products have no source point. */
  storeId: int("storeId"),
  evotorProductId: varchar("evotorProductId", { length: 128 }).notNull(),
  evotorCode: varchar("evotorCode", { length: 128 }),
  /** Once an administrator saves the card, scheduled read-only imports must not roll its business fields back. */
  metadataSource: mysqlEnum("metadataSource", ["evotor", "manual"]).default("evotor").notNull(),
  canonicalName: varchar("canonicalName", { length: 512 }).notNull(),
  barcodes: json("barcodes"),
  /** Read-only category name resolved from Evotor's product-group hierarchy. */
  evotorCategoryName: varchar("evotorCategoryName", { length: 512 }),
  /** Administrator-managed network category; raw Evotor group stays in evotorCategoryName. */
  catalogCategoryId: int("catalogCategoryId"),
  /** `fraction` is the Evotor weight code and is rendered as «кг» in every user-facing view. */
  baseUnit: mysqlEnum("baseUnit", ["fraction", "l", "piece", "unknown"]).default("unknown").notNull(),
  /** Network works only with VAT. The default for a manually added item is 10%. */
  vatRate: mysqlEnum("vatRate", ["VAT_10", "VAT_22"]).default("VAT_10").notNull(),
  /** Read-only Evotor cost; 0 means not supplied and can remain visually hidden. */
  evotorCostPrice: decimal("evotorCostPrice", { precision: 18, scale: 2 }).default("0.00").notNull(),
  /** Internal management cost; never sent back to Evotor. */
  internalCostPrice: decimal("internalCostPrice", { precision: 18, scale: 2 }),
  /** Opt-in only: an administrator may publish the internal purchase cost to Evotor. */
  isEvotorCostExportEnabled: boolean("isEvotorCostExportEnabled").default(false).notNull(),
  /** Controlled marking choice; product-level rather than store-level. */
  markingCategory: mysqlEnum("markingCategory", ["none", "supplement", "seafood_caviar", "seafood_canned", "alcohol", "beer_marked", "beer_non_alcoholic", "soft_drinks", "water", "dairy"]).default("none").notNull(),
  /** Alcohol-specific data is required only when the controlled marking selection is alcohol. */
  alcoholCode: varchar("alcoholCode", { length: 255 }),
  alcoholTypeCode: varchar("alcoholTypeCode", { length: 64 }),
  alcoholStrengthPercent: decimal("alcoholStrengthPercent", { precision: 5, scale: 2 }),
  alcoholVolumeLiters: decimal("alcoholVolumeLiters", { precision: 8, scale: 3 }),
  /** Manually confirmed barcodes, normalized as semicolon-separated text. */
  manualBarcodes: text("manualBarcodes"),
  /** A hidden product is excluded from future store requests, but never from history. */
  isVisibleInRequests: boolean("isVisibleInRequests").default(true).notNull(),
  /** Administrative future flag only: the present Evotor integration stays strictly read-only. */
  isEvotorExportEnabled: boolean("isEvotorExportEnabled").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  /** Null means a platform schedule performed a read-only source refresh. */
  importedByAccountId: int("importedByAccountId"),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_catalog_store_evotor_product_uq").on(table.storeId, table.evotorProductId)]);

/** Network category master. Categories are archived instead of hard-deleted so print history remains reproducible. */
export const operationalCatalogCategories = mysqlTable("operational_catalog_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 560 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdByAccountId: int("createdByAccountId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_catalog_category_name_uq").on(table.normalizedName)]);

/** Network-wide sale price classes. A store is assigned exactly one active class. */
export const operationalPriceTypes = mysqlTable("operational_price_types", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 160 }).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_price_type_name_uq").on(table.normalizedName)]);

/** Store equals warehouse in the operating model; the assignment changes only the sale-price projection. */
export const operationalStorePriceTypes = mysqlTable("operational_store_price_types", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  priceTypeId: int("priceTypeId").notNull(),
  assignedByAccountId: int("assignedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_store_price_type_store_uq").on(table.storeId)]);

/** Editable print groups are shared by warehouse settings and future store requests. */
export const operationalPrintGroups = mysqlTable("operational_print_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 160 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_print_group_name_uq").on(table.normalizedName)]);

/** One network-wide, admin-only print preference row. The default keeps paper entirely white. */
export const operationalRequestPrintSettings = mysqlTable("operational_request_print_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** No color is the default; a restrained neutral zebra may be selected for dense paper tables. */
  zebraMode: mysqlEnum("zebraMode", ["none", "rows", "columns"]).default("none").notNull(),
  /** Independent compact typography controls, expressed in points for A4 print media. */
  headingFontSize: int("headingFontSize").default(10).notNull(),
  bodyFontSize: int("bodyFontSize").default(9).notNull(),
  totalFontSize: int("totalFontSize").default(9).notNull(),
  headingBold: boolean("headingBold").default(true).notNull(),
  bodyBold: boolean("bodyBold").default(false).notNull(),
  totalBold: boolean("totalBold").default(true).notNull(),
  /** Each fact under a requested product can be explicitly kept on or off for paper output. */
  showStoreQuantity: boolean("showStoreQuantity").default(true).notNull(),
  showAverageDailySales: boolean("showAverageDailySales").default(true).notNull(),
  showSalesCover: boolean("showSalesCover").default(true).notNull(),
  showOverstockSignal: boolean("showOverstockSignal").default(true).notNull(),
  recommendationFontSize: int("recommendationFontSize").default(7).notNull(),
  recommendationTone: mysqlEnum("recommendationTone", ["muted", "dark"]).default("muted").notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/** A separate singleton keeps revenue-print preferences independent from request sheets. */
export const operationalRevenuePrintSettings = mysqlTable("operational_revenue_print_settings", {
  id: int("id").autoincrement().primaryKey(),
  /** Blank paper remains the default; an optional neutral zebra is limited to table data cells. */
  zebraMode: mysqlEnum("zebraMode", ["none", "rows", "columns"]).default("none").notNull(),
  /** The revenue sheet follows the same independently configurable A4 typography as requests. */
  headingFontSize: int("headingFontSize").default(10).notNull(),
  bodyFontSize: int("bodyFontSize").default(9).notNull(),
  totalFontSize: int("totalFontSize").default(9).notNull(),
  headingBold: boolean("headingBold").default(true).notNull(),
  bodyBold: boolean("bodyBold").default(false).notNull(),
  totalBold: boolean("totalBold").default(true).notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/** One optional warehouse setup per existing internal store; hiding a store remains governed by audit_stores.isHidden. */
export const operationalWarehouseSettings = mysqlTable("operational_warehouse_settings", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  printGroupId: int("printGroupId"),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_warehouse_store_uq").on(table.storeId)]);

/** Explicit business mapping from a declared 1С source warehouse (БМ/СРС) to an operational group. */
export const operationalOnecWarehouseGroupMappings = mysqlTable("operational_onec_warehouse_group_mappings", {
  id: int("id").autoincrement().primaryKey(),
  warehouseCode: varchar("warehouseCode", { length: 32 }).notNull(),
  printGroupId: int("printGroupId").notNull(),
  mappedByAccountId: int("mappedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_warehouse_group_uq").on(table.warehouseCode)]);

/** Configurable printing rules for product categories, including nested groups such as SRS → SRS V/U. */
export const operationalPrintCategoryGroups = mysqlTable("operational_print_category_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 160 }).notNull(),
  /** Per-store gives one sheet per store; grouped stores consolidate a category group on one sheet. */
  printMode: mysqlEnum("printMode", ["per_store", "grouped_stores"]).default("per_store").notNull(),
  /** The configured warehouse print group is the qualitative supply-stock source for this product category. */
  supplyPrintGroupId: int("supplyPrintGroupId"),
  /** A request comment slot is configured once here, not selected separately in every request. */
  requestCommentSlot: mysqlEnum("requestCommentSlot", ["slot_1", "slot_2"]),
  /** Store stock above this category-specific cover is not recommended for fresh daily replenishment. */
  maxStoreCoverDays: int("maxStoreCoverDays").default(2).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_print_category_group_name_uq").on(table.normalizedName)]);

/** A member is either one catalog category name or another print-category group; service rules prevent cycles. */
export const operationalPrintCategoryGroupMembers = mysqlTable("operational_print_category_group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  memberType: mysqlEnum("memberType", ["catalog_category", "category_group"]).notNull(),
  /** Stable master-category link. catalogCategory remains only as a legacy print-history fallback. */
  catalogCategoryId: int("catalogCategoryId"),
  catalogCategory: varchar("catalogCategory", { length: 512 }),
  childGroupId: int("childGroupId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  unique("operational_print_category_member_uq").on(table.groupId, table.memberType, table.catalogCategory, table.childGroupId),
]);

/** A missing row intentionally means that the product has no stated sale price for the selected price type. */
export const operationalProductSalePrices = mysqlTable("operational_product_sale_prices", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  priceTypeId: int("priceTypeId").notNull(),
  salePrice: decimal("salePrice", { precision: 18, scale: 2 }).notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_product_sale_price_uq").on(table.productId, table.priceTypeId)]);

/** Read-only external identifiers are linked manually to a global product; no name-based automatic merge is allowed. */
export const operationalEvotorProductLinks = mysqlTable("operational_evotor_product_links", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  evotorProductId: varchar("evotorProductId", { length: 128 }).notNull(),
  productId: int("productId").notNull(),
  /** Current quantity from the read-only Evotor catalog; later manual/inventory movements are applied above it. */
  evotorQuantitySnapshot: decimal("evotorQuantitySnapshot", { precision: 16, scale: 3 }),
  evotorQuantityUpdatedAt: timestamp("evotorQuantityUpdatedAt"),
  /** A confirmed reset keeps its own baseline time until Evotor reports a different physical quantity. */
  evotorQuantitySource: mysqlEnum("evotorQuantitySource", ["catalog", "confirmed_reset"]).default("catalog").notNull(),
  /** Null means a platform schedule established an existing source linkage. */
  linkedByAccountId: int("linkedByAccountId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  /** One remote UUID cannot point to two local products in the same store. */
  unique("operational_evotor_product_link_uq").on(table.storeId, table.evotorProductId),
  /** One local product must retain exactly one current V2 identity in each store. */
  unique("operational_evotor_product_link_store_product_uq").on(table.storeId, table.productId),
]);

/**
 * Durable, idempotent outbound work created only by a conducted stock or catalog
 * change. The worker recalculates the current ledger quantity at delivery time,
 * so several rapid movements cannot publish an obsolete intermediate balance.
 */
export const operationalEvotorOutboundJobs = mysqlTable("operational_evotor_outbound_jobs", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  /** Immutable origin, e.g. `transfer:42:5:117`; makes retries and callbacks idempotent. */
  sourceKey: varchar("sourceKey", { length: 191 }).notNull(),
  reason: mysqlEnum("reason", ["catalog_create", "catalog_update", "catalog_enable", "catalog_archive", "full_catalog_export", "price_update", "warehouse_mapping", "inventory_close", "stock_adjustment", "transfer", "shipment_receipt"]).notNull(),
  /** `submitted` means the bulk request was accepted but GET /bulks/{id} has not confirmed it yet. */
  status: mysqlEnum("status", ["pending", "processing", "submitted", "retry", "succeeded", "failed"]).default("pending").notNull(),
  attemptCount: int("attemptCount").default(0).notNull(),
  lastError: varchar("lastError", { length: 512 }),
  lastAttemptAt: timestamp("lastAttemptAt"),
  /** Cloud V2 asynchronous bulk task ID. Its terminal state, not HTTP acceptance, completes delivery. */
  externalBulkId: varchar("externalBulkId", { length: 128 }),
  bulkSubmittedAt: timestamp("bulkSubmittedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  unique("operational_evotor_outbound_source_uq").on(table.sourceKey),
  index("operational_evotor_outbound_pending_idx").on(table.status, table.createdAt),
  index("operational_evotor_outbound_store_product_idx").on(table.storeId, table.productId),
]);

/** One administrative, read-only cursor import. It retains neither credentials nor raw fiscal payloads. */
export const operationalEvotorDocumentSyncs = mysqlTable("operational_evotor_document_syncs", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  /** Current-day refresh is deliberately separate from the one-time 2025+ backfill cursor. */
  syncMode: mysqlEnum("syncMode", ["historical", "current_day"]).default("historical").notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  cursor: varchar("cursor", { length: 512 }),
  /** The fixed first-page window. Cursor calls continue this exact bounded series. */
  requestedFrom: varchar("requestedFrom", { length: 10 }),
  requestedTo: varchar("requestedTo", { length: 10 }),
  documentsRead: int("documentsRead").default(0).notNull(),
  positionsRead: int("positionsRead").default(0).notNull(),
  /** Null means a scheduled system read; interactive imports retain their actor. */
  startedByAccountId: int("startedByAccountId"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  failureMessage: varchar("failureMessage", { length: 512 }),
});

/**
 * Platform heartbeat callbacks are dereferenced by the opaque task UID rather
 * than by a request body.  This keeps recurring read-only Evotor work
 * idempotent, pausable and isolated from user-session actions.
 */
export const operationalScheduledSyncJobs = mysqlTable("operational_scheduled_sync_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /**
   * The retired single catalog callback is retained for its audit trail. Four
   * active catalog lanes and four current-day receipt lanes divide visible
   * mappings deterministically, avoiding a wide external API burst.
   */
  kind: mysqlEnum("kind", [
    "evotor_catalog", "evotor_catalog_current_1", "evotor_catalog_current_2", "evotor_catalog_current_3", "evotor_catalog_current_4",
    "evotor_documents",
    "evotor_documents_current_1", "evotor_documents_current_2", "evotor_documents_current_3", "evotor_documents_current_4",
    "evotor_documents_current_5", "evotor_documents_current_6", "evotor_documents_current_7", "evotor_documents_current_8",
    "evotor_documents_current_9", "evotor_documents_current_10", "evotor_documents_current_11", "evotor_documents_current_12",
    "evotor_documents_current_13", "evotor_documents_current_14", "evotor_documents_current_15", "evotor_documents_current_16",
    "evotor_documents_current_17", "evotor_documents_current_18", "evotor_documents_current_19", "evotor_documents_current_20",
    "evotor_documents_current_21", "evotor_documents_current_22", "evotor_documents_current_23", "evotor_documents_current_24",
    "evotor_documents_current_25", "evotor_documents_current_26", "evotor_documents_current_27", "evotor_documents_current_28",
    "evotor_documents_current_29", "evotor_documents_current_30", "evotor_documents_current_31", "evotor_documents_current_32",
  ]).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).unique(),
  isActive: boolean("isActive").default(true).notNull(),
  /** Emergency business stop for write-back; read-only catalog refresh may remain active. */
  isOutboundPaused: boolean("isOutboundPaused").default(false).notNull(),
  lastStartedAt: timestamp("lastStartedAt"),
  lastCompletedAt: timestamp("lastCompletedAt"),
  lastError: varchar("lastError", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_scheduled_sync_kind_uq").on(table.kind)]);

/** Immutable per-store evidence of a read-only catalog lane attempt. */
export const operationalEvotorCatalogLaneAttempts = mysqlTable("operational_evotor_catalog_lane_attempts", {
  id: int("id").autoincrement().primaryKey(),
  laneKind: mysqlEnum("laneKind", ["evotor_catalog_current_1", "evotor_catalog_current_2", "evotor_catalog_current_3", "evotor_catalog_current_4"]).notNull(),
  storeId: int("storeId").notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  productsRead: int("productsRead").default(0).notNull(),
  failureMessage: varchar("failureMessage", { length: 512 }),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, table => [
  index("operational_evotor_catalog_lane_store_started_idx").on(table.laneKind, table.storeId, table.startedAt),
  index("operational_evotor_catalog_lane_status_idx").on(table.status, table.startedAt),
]);

/**
 * Optional encrypted override of the server-supplied Evotor token. Plaintext is
 * never stored, audited or returned by ordinary status queries.
 */
export const operationalEvotorCredentials = mysqlTable("operational_evotor_credentials", {
  id: int("id").autoincrement().primaryKey(),
  credentialKey: varchar("credentialKey", { length: 64 }).notNull(),
  encryptedToken: varchar("encryptedToken", { length: 4096 }).notNull(),
  initializationVector: varchar("initializationVector", { length: 64 }).notNull(),
  authenticationTag: varchar("authenticationTag", { length: 64 }).notNull(),
  /** A non-reversible fingerprint is for rotation/audit metadata only. */
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_evotor_credential_key_uq").on(table.credentialKey)]);

/**
 * Per-user tokens issued by the official V1 create/verify flow. The original
 * token is returned to Evotor once and never persisted, logged or exposed.
 */
export const operationalEvotorWebhookUsers = mysqlTable("operational_evotor_webhook_users", {
  id: int("id").autoincrement().primaryKey(),
  evotorUserId: varchar("evotorUserId", { length: 96 }).notNull(),
  tokenFingerprint: varchar("tokenFingerprint", { length: 64 }).notNull(),
  lastAuthorizedAt: timestamp("lastAuthorizedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  unique("operational_evotor_webhook_user_uq").on(table.evotorUserId),
  unique("operational_evotor_webhook_user_token_uq").on(table.tokenFingerprint),
]);

/**
 * Cloud V1 delivers this user token after an application is installed. It is
 * separate from the opaque token our V1 document receiver issues on
 * `/user/create` and `/user/verify`; both are encrypted/hashed independently.
 */
export const operationalEvotorCloudUserTokens = mysqlTable("operational_evotor_cloud_user_tokens", {
  id: int("id").autoincrement().primaryKey(),
  evotorUserId: varchar("evotorUserId", { length: 96 }).notNull(),
  encryptedToken: varchar("encryptedToken", { length: 4096 }).notNull(),
  initializationVector: varchar("initializationVector", { length: 64 }).notNull(),
  authenticationTag: varchar("authenticationTag", { length: 64 }).notNull(),
  /** A non-reversible fingerprint supports replacement auditing without exposure. */
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_evotor_cloud_user_token_uq").on(table.evotorUserId)]);

/**
 * Dedicated inbound credential for 1С. The plaintext key is encrypted at rest,
 * is never logged or included in the import payload/audit, and protects only
 * the one-way 1С → application JSON receiver.
 */
export const operationalOnecInboundCredentials = mysqlTable("operational_onec_inbound_credentials", {
  id: int("id").autoincrement().primaryKey(),
  credentialKey: varchar("credentialKey", { length: 64 }).notNull(),
  encryptedToken: varchar("encryptedToken", { length: 4096 }).notNull(),
  initializationVector: varchar("initializationVector", { length: 64 }).notNull(),
  authenticationTag: varchar("authenticationTag", { length: 64 }).notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  lastAcceptedAt: timestamp("lastAcceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_inbound_credential_key_uq").on(table.credentialKey)]);

/** Normalized, non-fiscal document facts read from a fixed Evotor store mapping. */
export const operationalEvotorDocuments = mysqlTable("operational_evotor_documents", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  syncId: int("syncId").notNull(),
  evotorDocumentId: varchar("evotorDocumentId", { length: 128 }).notNull(),
  /** Human receipt number only when Cloud API V2 explicitly supplies it; never a fiscal or device identifier. */
  receiptNumber: varchar("receiptNumber", { length: 64 }),
  documentType: varchar("documentType", { length: 64 }).notNull(),
  /** API V2 filters `since` by this source creation time; kept only to advance the read-only stream. */
  sourceCreatedAt: varchar("sourceCreatedAt", { length: 64 }),
  occurredAt: varchar("occurredAt", { length: 64 }),
  total: decimal("total", { precision: 18, scale: 2 }),
  /** Read-only aggregate discount only when V2 supplies an explicit numeric total; null is not zero. */
  discountAmount: decimal("discountAmount", { precision: 18, scale: 2 }),
  /** Only safe aggregate V2 payment facts; no payment identifiers, parts or requisites are retained. */
  /** Net cash payment after explicitly supplied cash change. */
  cashAmount: decimal("cashAmount", { precision: 18, scale: 2 }),
  /** Tendered cash and change stay as aggregates so a receipt can be reconciled without raw payment data. */
  cashTenderedAmount: decimal("cashTenderedAmount", { precision: 18, scale: 2 }),
  cashChangeAmount: decimal("cashChangeAmount", { precision: 18, scale: 2 }),
  cashlessAmount: decimal("cashlessAmount", { precision: 18, scale: 2 }),
  otherPaymentAmount: decimal("otherPaymentAmount", { precision: 18, scale: 2 }),
  unknownPaymentAmount: decimal("unknownPaymentAmount", { precision: 18, scale: 2 }),
  /** `unavailable` is distinct from zero: it means the source did not yield a usable payment array. */
  paymentCaptureStatus: mysqlEnum("paymentCaptureStatus", ["unavailable", "complete", "unreconciled", "malformed"]).default("unavailable").notNull(),
  paymentReconciliationDelta: decimal("paymentReconciliationDelta", { precision: 18, scale: 2 }),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
}, table => [unique("operational_evotor_document_uq").on(table.storeId, table.evotorDocumentId), index("operational_evotor_document_source_time_idx").on(table.storeId, table.sourceCreatedAt), index("operational_evotor_document_sales_time_idx").on(table.storeId, table.documentType, table.occurredAt), index("operational_evotor_receipt_number_idx").on(table.storeId, table.receiptNumber)]);

/** Normalized document position. Fiscal identifiers, device data, payment requisites and raw payloads are excluded. */
export const operationalEvotorDocumentPositions = mysqlTable("operational_evotor_document_positions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  evotorProductId: varchar("evotorProductId", { length: 128 }),
  productName: varchar("productName", { length: 512 }),
  quantity: decimal("quantity", { precision: 16, scale: 3 }),
  initialQuantity: decimal("initialQuantity", { precision: 16, scale: 3 }),
  unit: varchar("unit", { length: 64 }),
  settlementMethod: varchar("settlementMethod", { length: 64 }),
  resultSum: decimal("resultSum", { precision: 18, scale: 2 }),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
}, table => [unique("operational_evotor_document_position_uq").on(table.documentId, table.evotorProductId, table.productName), index("operational_evotor_position_document_idx").on(table.documentId)]);

/**
 * Idempotent operational deltas from normalized receipt positions.  They are
 * never sent back to Evotor: a newer catalog snapshot replaces an older delta
 * in the common snapshot-first projection, preventing double counting.
 */
export const operationalEvotorReceiptStockMovements = mysqlTable("operational_evotor_receipt_stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  documentPositionId: int("documentPositionId").notNull(),
  documentId: int("documentId").notNull(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 16, scale: 3 }).notNull(),
  occurredAt: timestamp("occurredAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  unique("operational_evotor_receipt_stock_position_uq").on(table.documentPositionId),
  index("operational_evotor_receipt_stock_lookup_idx").on(table.storeId, table.productId, table.occurredAt),
]);

/** A zero is valid: absence must never be represented by silently omitting a counted product. */
export const operationalInventoryLines = mysqlTable("operational_inventory_lines", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventoryId").notNull(),
  productId: int("productId").notNull(),
  countedQuantity: decimal("countedQuantity", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_inventory_line_product_uq").on(table.inventoryId, table.productId)]);

/**
 * A transfer is prepared as an editable document, then posted as exactly two
 * immutable ledger events for every line. Drafts do not affect a balance.
 */
export const operationalStockTransfers = mysqlTable("operational_stock_transfers", {
  id: int("id").autoincrement().primaryKey(),
  /** Short, sequential document number; never expose a technical auto-increment id as a draft number. */
  transferNumber: int("transferNumber").notNull().unique(),
  sourceStoreId: int("sourceStoreId").notNull(),
  destinationStoreId: int("destinationStoreId").notNull(),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  /** A reversal is a new inverse document; the original ledger entries are never edited or deleted. */
  reversalOfTransferId: int("reversalOfTransferId").unique(),
  status: mysqlEnum("status", ["draft", "posted", "reversed"]).default("draft").notNull(),
  note: varchar("note", { length: 512 }),
  createdByAccountId: int("createdByAccountId").notNull(),
  postedByAccountId: int("postedByAccountId"),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Lines remain mutable only until their parent transfer is posted. */
export const operationalStockTransferLines = mysqlTable("operational_stock_transfer_lines", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull(),
  productId: int("productId").notNull(),
  quantity: decimal("quantity", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_stock_transfer_line_product_uq").on(table.transferId, table.productId)]);

/**
 * An immutable received 1С package. The package is separate from financial
 * Excel and does not alter a shop ledger merely by being imported.
 */
export const operationalOnecImportBatches = mysqlTable("operational_onec_import_batches", {
  id: int("id").autoincrement().primaryKey(),
  sourceSystem: varchar("sourceSystem", { length: 128 }).notNull(),
  entity: mysqlEnum("entity", ["inventory_snapshots", "store_shipments", "purchase_costs"]).notNull(),
  batchId: varchar("batchId", { length: 191 }).notNull(),
  schemaVersion: varchar("schemaVersion", { length: 32 }).notNull(),
  generatedAt: varchar("generatedAt", { length: 64 }).notNull(),
  asOf: varchar("asOf", { length: 64 }),
  status: mysqlEnum("status", ["applied", "quarantined", "mixed"]).notNull(),
  totalRecords: int("totalRecords").notNull(),
  acceptedRecords: int("acceptedRecords").notNull(),
  quarantinedRecords: int("quarantinedRecords").notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_onec_batch_uq").on(table.sourceSystem, table.entity, table.batchId), index("operational_onec_batch_entity_idx").on(table.entity, table.createdAt)]);

/**
 * Immutable 1С purchase-cost entries. They deliberately do not overwrite the
 * global management cost merely because a warehouse supplied a value: when BM
 * and SRS disagree, an administrator chooses an explicitly received row.
 */
export const operationalOnecPurchaseCosts = mysqlTable("operational_onec_purchase_costs", {
  id: int("id").autoincrement().primaryKey(),
  batchImportId: int("batchImportId").notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 191 }).notNull(),
  productId: int("productId"),
  productSourceId: varchar("productSourceId", { length: 191 }).notNull(),
  /** Business label from the received export; the opaque 1С identifier stays server-side. */
  productName: varchar("productName", { length: 512 }),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  purchasePrice: decimal("purchasePrice", { precision: 18, scale: 2 }).notNull(),
  effectiveDate: varchar("effectiveDate", { length: 10 }).notNull(),
  /** Optional source context; BM/SRS are preserved instead of being silently merged. */
  warehouseCode: varchar("warehouseCode", { length: 32 }),
  basis: varchar("basis", { length: 512 }),
  mappingState: mysqlEnum("mappingState", ["mapped", "quarantined"]).notNull(),
  appliedToCatalogAt: timestamp("appliedToCatalogAt"),
  appliedToCatalogByAccountId: int("appliedToCatalogByAccountId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  unique("operational_onec_purchase_cost_record_uq").on(table.batchImportId, table.sourceRecordId),
  index("operational_onec_purchase_cost_product_idx").on(table.productId, table.effectiveDate),
  index("operational_onec_purchase_cost_warehouse_idx").on(table.warehouseCode, table.effectiveDate),
]);

/** Full snapshots for the two 1С warehouses only. A missing product mapping stays quarantined. */
export const operationalOnecWarehouseSnapshots = mysqlTable("operational_onec_warehouse_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  batchImportId: int("batchImportId").notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 191 }).notNull(),
  warehouseCode: varchar("warehouseCode", { length: 32 }).notNull(),
  productId: int("productId"),
  productSourceId: varchar("productSourceId", { length: 191 }).notNull(),
  /** Business label from the received export; the source identifier is never shown in the UI. */
  productName: varchar("productName", { length: 512 }),
  quantityOnHand: decimal("quantityOnHand", { precision: 16, scale: 3 }).notNull(),
  quantityAvailable: decimal("quantityAvailable", { precision: 16, scale: 3 }),
  /** ISO calendar date of the specific lot when 1С supplies it; null is unknown, never a fictitious expiry. */
  expirationDate: varchar("expirationDate", { length: 10 }),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  asOf: varchar("asOf", { length: 64 }).notNull(),
  mappingState: mysqlEnum("mappingState", ["mapped", "quarantined"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_onec_snapshot_record_uq").on(table.batchImportId, table.sourceRecordId), index("operational_onec_snapshot_warehouse_idx").on(table.warehouseCode, table.businessDate), index("operational_onec_snapshot_expiry_idx").on(table.expirationDate)]);

/** A 1С product identifier is joined only after an administrator explicitly confirms it. */
export const operationalOnecProductLinks = mysqlTable("operational_onec_product_links", {
  id: int("id").autoincrement().primaryKey(),
  sourceSystem: varchar("sourceSystem", { length: 128 }).notNull(),
  sourceProductId: varchar("sourceProductId", { length: 191 }).notNull(),
  productId: int("productId").notNull(),
  mappedByAccountId: int("mappedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_product_link_source_uq").on(table.sourceSystem, table.sourceProductId)]);

/** A recipient reference from 1С is joined only after an administrator explicitly confirms the shop. */
export const operationalOnecStoreLinks = mysqlTable("operational_onec_store_links", {
  id: int("id").autoincrement().primaryKey(),
  sourceSystem: varchar("sourceSystem", { length: 128 }).notNull(),
  destinationReference: varchar("destinationReference", { length: 191 }).notNull(),
  storeId: int("storeId").notNull(),
  mappedByAccountId: int("mappedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_store_link_source_uq").on(table.sourceSystem, table.destinationReference)]);

/** Headers of outbound 1С warehouse → shop invoices; mapping is explicit and does not conduct stock automatically. */
export const operationalOnecStoreShipments = mysqlTable("operational_onec_store_shipments", {
  id: int("id").autoincrement().primaryKey(),
  batchImportId: int("batchImportId").notNull(),
  shipmentId: varchar("shipmentId", { length: 191 }).notNull(),
  revisionId: varchar("revisionId", { length: 191 }).notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 191 }).notNull(),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  originWarehouseCode: varchar("originWarehouseCode", { length: 32 }).notNull(),
  /** Opaque recipient key from 1С; no address is persisted or displayed here. */
  destinationReference: varchar("destinationReference", { length: 191 }).notNull(),
  destinationStoreId: int("destinationStoreId"),
  documentNumber: varchar("documentNumber", { length: 128 }),
  sourceStatus: mysqlEnum("sourceStatus", ["posted", "cancelled", "corrected"]).notNull(),
  mappingState: mysqlEnum("mappingState", ["unmapped", "mapped", "quarantined"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_onec_shipment_revision_uq").on(table.shipmentId, table.revisionId), index("operational_onec_shipment_date_idx").on(table.businessDate, table.mappingState)]);

/** Shipment lines retain only operational product linkage and quantity; no source payload or address is mirrored in UI. */
export const operationalOnecShipmentLines = mysqlTable("operational_onec_shipment_lines", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  sourceLineId: varchar("sourceLineId", { length: 191 }).notNull(),
  productId: int("productId"),
  productSourceId: varchar("productSourceId", { length: 191 }).notNull(),
  /** Business label from the received export; the source identifier is never shown in the UI. */
  productName: varchar("productName", { length: 512 }),
  quantity: decimal("quantity", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  /** ISO calendar date of the lot sent from BM/SRS to the shop; no expiry is inferred when absent. */
  expirationDate: varchar("expirationDate", { length: 10 }),
  mappingState: mysqlEnum("mappingState", ["mapped", "quarantined"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_onec_shipment_line_uq").on(table.shipmentId, table.sourceLineId), index("operational_onec_shipment_line_expiry_idx").on(table.expirationDate)]);

/**
 * A shop verifies an already mapped 1С shipment before it can affect its own
 * stock. Reporting is editable until manager/admin confirmation; both the
 * expected and actual values remain in the immutable receipt record.
 */
export const operationalOnecShipmentReceipts = mysqlTable("operational_onec_shipment_receipts", {
  id: int("id").autoincrement().primaryKey(),
  shipmentId: int("shipmentId").notNull(),
  storeId: int("storeId").notNull(),
  status: mysqlEnum("status", ["awaiting_store", "reported", "confirmed"]).default("awaiting_store").notNull(),
  storeNote: varchar("storeNote", { length: 512 }),
  reportedByAccountId: int("reportedByAccountId"),
  reportedAt: timestamp("reportedAt"),
  confirmedByAccountId: int("confirmedByAccountId"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_shipment_receipt_shipment_uq").on(table.shipmentId), index("operational_onec_shipment_receipt_store_idx").on(table.storeId, table.status)]);

/** Expected quantity is copied from the 1С shipment; actual quantity is supplied by the shop. */
export const operationalOnecShipmentReceiptLines = mysqlTable("operational_onec_shipment_receipt_lines", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(),
  shipmentLineId: int("shipmentLineId").notNull(),
  productId: int("productId").notNull(),
  expectedQuantity: decimal("expectedQuantity", { precision: 16, scale: 3 }).notNull(),
  actualQuantity: decimal("actualQuantity", { precision: 16, scale: 3 }),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_onec_receipt_line_shipment_line_uq").on(table.shipmentLineId), index("operational_onec_receipt_line_receipt_idx").on(table.receiptId)]);

/** Immutable stock adjustments preserve inventory, correction and transfer facts. */
export const operationalStockMovements = mysqlTable("operational_stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  inventoryId: int("inventoryId"),
  transferId: int("transferId"),
  /** One accepted 1С shipment lot can create no more than one incoming ledger event. */
  shipmentReceiptLineId: int("shipmentReceiptLineId"),
  /** The other side of a transfer; null for inventory and manual adjustments. */
  relatedStoreId: int("relatedStoreId"),
  kind: mysqlEnum("kind", ["first_count", "inventory_adjustment", "manual_adjustment", "transfer_out", "transfer_in", "shipment_receipt"]).notNull(),
  previousQuantity: decimal("previousQuantity", { precision: 16, scale: 3 }).notNull(),
  countedQuantity: decimal("countedQuantity", { precision: 16, scale: 3 }).notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  adjustmentReason: varchar("adjustmentReason", { length: 512 }),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  unique("operational_stock_movement_inventory_product_uq").on(table.inventoryId, table.productId),
  unique("operational_stock_movement_receipt_line_uq").on(table.shipmentReceiptLineId),
]);

/**
 * A request is an operational order draft for exactly one warehouse.  A nullable
 * draft key permits one open request per store while retaining arbitrarily many
 * immutable closed requests for the same business date.
 */
export const operationalStoreRequests = mysqlTable("operational_store_requests", {
  id: int("id").autoincrement().primaryKey(),
  requestNumber: int("requestNumber").notNull().unique(),
  storeId: int("storeId").notNull(),
  storeName: varchar("storeName", { length: 128 }).notNull(),
  businessDate: varchar("businessDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["draft", "closed"]).default("draft").notNull(),
  /** `draft:<storeId>` while open; null after closing preserves the unique draft invariant. */
  draftStoreKey: varchar("draftStoreKey", { length: 64 }).unique(),
  note: text("note"),
  createdByAccountId: int("createdByAccountId").notNull(),
  closedByAccountId: int("closedByAccountId"),
  closedAt: timestamp("closedAt"),
  /** Hidden closed requests stay immutable in the audit trail but leave default history and print projections. */
  isHidden: boolean("isHidden").default(false).notNull(),
  hiddenByAccountId: int("hiddenByAccountId"),
  hiddenAt: timestamp("hiddenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Product data is snapshotted with the request line so a closed print remains
 * reproducible even when the common catalogue changes later.  Costs are
 * intentionally absent from the operating request contour.
 */
export const operationalStoreRequestLines = mysqlTable("operational_store_request_lines", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  /** Null only for a one-off line added to an order before its catalog card exists. */
  productId: int("productId"),
  catalogNumber: int("catalogNumber").notNull(),
  productName: varchar("productName", { length: 512 }).notNull(),
  /** A request-only product name; it never creates or changes the common catalog. */
  manualProductName: varchar("manualProductName", { length: 512 }),
  /** Category ID is snapshotted so a later category rename never changes a closed printed request. */
  catalogCategoryId: int("catalogCategoryId"),
  categoryName: varchar("categoryName", { length: 512 }),
  /** Selected only for a manual line so it reaches the intended configured print sheet. */
  manualPrintCategoryGroupId: int("manualPrintCategoryGroupId"),
  requestedQuantity: decimal("requestedQuantity", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  note: varchar("note", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_store_request_line_product_uq").on(table.requestId, table.productId)]);

/**
 * Two optional operational comments may be attached to a request.  Each one is
 * explicitly assigned to a product print category so the comment appears only
 * on the matching printed sheet.  The category name is snapshotted to preserve
 * the historical meaning if the printing setup is renamed later.
 */
export const operationalStoreRequestComments = mysqlTable("operational_store_request_comments", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  slot: int("slot").notNull(),
  printCategoryGroupId: int("printCategoryGroupId").notNull(),
  printCategoryGroupName: varchar("printCategoryGroupName", { length: 128 }).notNull(),
  text: varchar("text", { length: 2_000 }).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  updatedByAccountId: int("updatedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_store_request_comment_slot_uq").on(table.requestId, table.slot)]);

export type OperationalInventory = typeof operationalInventories.$inferSelect;
export type OperationalCatalogProduct = typeof operationalCatalogProducts.$inferSelect;
export type OperationalCatalogCategory = typeof operationalCatalogCategories.$inferSelect;
export type OperationalPriceType = typeof operationalPriceTypes.$inferSelect;
export type OperationalStorePriceType = typeof operationalStorePriceTypes.$inferSelect;
export type OperationalProductSalePrice = typeof operationalProductSalePrices.$inferSelect;
export type OperationalEvotorProductLink = typeof operationalEvotorProductLinks.$inferSelect;
export type OperationalEvotorCatalogLaneAttempt = typeof operationalEvotorCatalogLaneAttempts.$inferSelect;
export type OperationalEvotorDocumentSync = typeof operationalEvotorDocumentSyncs.$inferSelect;
export type OperationalEvotorDocument = typeof operationalEvotorDocuments.$inferSelect;
export type OperationalEvotorDocumentPosition = typeof operationalEvotorDocumentPositions.$inferSelect;
export type OperationalInventoryLine = typeof operationalInventoryLines.$inferSelect;
export type OperationalStockMovement = typeof operationalStockMovements.$inferSelect;
export type OperationalStockTransfer = typeof operationalStockTransfers.$inferSelect;
export type OperationalStockTransferLine = typeof operationalStockTransferLines.$inferSelect;
export type OperationalStoreRequest = typeof operationalStoreRequests.$inferSelect;
export type OperationalStoreRequestLine = typeof operationalStoreRequestLines.$inferSelect;
export type OperationalStoreRequestComment = typeof operationalStoreRequestComments.$inferSelect;

/** Supplier catalog is deliberately isolated from financial facts and financial workbook imports. */
export const priceSuppliers = mysqlTable("price_suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 180 }).notNull().unique(),
  contactNote: text("contactNote"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Reusable price-control categories; hidden categories retain their full price history. */
export const priceCategories = mysqlTable("price_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 180 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Reusable values prevent product variants and sizes from drifting into near-duplicates. */
export const priceProductCharacteristics = mysqlTable("price_product_characteristics", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["variant", "size", "place_contents", "manufacturer"]).notNull(),
  value: varchar("value", { length: 160 }).notNull(),
  normalizedValue: varchar("normalizedValue", { length: 180 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("price_product_characteristic_uq").on(table.kind, table.normalizedValue)]);

/** A comparison name unites deliberately selected supplier goods without replacing the goods themselves. */
export const priceLinkGroups = mysqlTable("price_link_groups", {
  id: int("id").autoincrement().primaryKey(),
  linkCode: varchar("linkCode", { length: 4 }).notNull().unique(),
  canonicalName: varchar("canonicalName", { length: 255 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 512 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** The internal code is the durable identifier of one editable supplier good and later ERP integrations. */
export const priceProducts = mysqlTable("price_products", {
  id: int("id").autoincrement().primaryKey(),
  internalCode: varchar("internalCode", { length: 64 }).notNull().unique(),
  /** Deprecated legacy link code; retained until the group migration has been reconciled. */
  linkCode: varchar("linkCode", { length: 4 }).unique(),
  /** Required after the additive migration; nullable only to permit lossless seeding of historic goods. */
  linkGroupId: int("linkGroupId"),
  canonicalName: varchar("canonicalName", { length: 255 }).notNull(),
  normalizedSignature: varchar("normalizedSignature", { length: 512 }).notNull(),
  categoryId: int("categoryId"),
  category: varchar("category", { length: 160 }),
  variantCharacteristicId: int("variantCharacteristicId"),
  sizeCharacteristicId: int("sizeCharacteristicId"),
  placeContentsCharacteristicId: int("placeContentsCharacteristicId"),
  variant: varchar("variant", { length: 255 }),
  sizeText: varchar("sizeText", { length: 120 }),
  placeContents: varchar("placeContents", { length: 160 }),
  baseUnit: mysqlEnum("baseUnit", ["kg", "l", "piece", "unknown"]).default("unknown").notNull(),
  defaultWeightGrams: decimal("defaultWeightGrams", { precision: 12, scale: 2 }),
  defaultVolumeMl: decimal("defaultVolumeMl", { precision: 12, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const priceImports = mysqlTable("price_imports", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  sourceDate: varchar("sourceDate", { length: 10 }),
  sourceType: mysqlEnum("sourceType", ["xls", "xlsx", "pdf", "docx", "manual"]).notNull(),
  status: mysqlEnum("status", ["completed", "failed"]).default("completed").notNull(),
  rowCount: int("rowCount").default(0).notNull(),
  importedByAccountId: int("importedByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Original product line and parser outcome; source text is preserved for audit and later rematching. */
export const priceImportRows = mysqlTable("price_import_rows", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("importId").notNull(),
  sourceSheet: varchar("sourceSheet", { length: 128 }),
  sourceRowNumber: int("sourceRowNumber").notNull(),
  sourceSku: varchar("sourceSku", { length: 128 }),
  rawName: text("rawName").notNull(),
  normalizedName: varchar("normalizedName", { length: 512 }).notNull(),
  rawCategory: varchar("rawCategory", { length: 180 }),
  rawPackaging: varchar("rawPackaging", { length: 255 }),
  manufacturer: varchar("manufacturer", { length: 255 }),
  placeContents: varchar("placeContents", { length: 255 }),
  manufacturedOn: varchar("manufacturedOn", { length: 10 }),
  shelfLifeMonths: int("shelfLifeMonths"),
  expiresOn: varchar("expiresOn", { length: 10 }),
  rawAvailability: varchar("rawAvailability", { length: 128 }),
  rawPayload: json("rawPayload"),
  productId: int("productId"),
  mappingStatus: mysqlEnum("mappingStatus", ["linked", "suggested", "unmapped", "ignored"]).default("unmapped").notNull(),
  matchedBy: mysqlEnum("matchedBy", ["supplier_alias", "signature", "manual", "new_product", "none"]).default("none").notNull(),
  matchConfidence: decimal("matchConfidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("price_import_row_source_uq").on(table.importId, table.sourceSheet, table.sourceRowNumber)]);

/** Each available price option is stored separately: city, payment form and purchase threshold stay explicit. */
export const priceOfferPrices = mysqlTable("price_offer_prices", {
  id: int("id").autoincrement().primaryKey(),
  importRowId: int("importRowId").notNull(),
  priceMode: mysqlEnum("priceMode", ["standard", "cash", "cashless_no_vat", "cashless_vat", "spb", "moscow", "special", "threshold"]).default("standard").notNull(),
  market: mysqlEnum("market", ["unknown", "spb", "moscow"]).default("unknown").notNull(),
  priceAmount: decimal("priceAmount", { precision: 18, scale: 2 }).notNull(),
  priceBasis: mysqlEnum("priceBasis", ["kg", "l", "piece", "package", "unknown"]).default("unknown").notNull(),
  normalizedPrice: decimal("normalizedPrice", { precision: 18, scale: 2 }),
  normalizedUnit: mysqlEnum("normalizedUnit", ["kg", "l", "piece", "unknown"]).default("unknown").notNull(),
  minimumQuantityKg: decimal("minimumQuantityKg", { precision: 12, scale: 2 }),
  includesVat: boolean("includesVat"),
  sourcePriceText: varchar("sourcePriceText", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Exact supplier naming is higher priority than fuzzy matching on future imports. */
export const priceSupplierAliases = mysqlTable("price_supplier_aliases", {
  id: int("id").autoincrement().primaryKey(),
  supplierId: int("supplierId").notNull(),
  productId: int("productId").notNull(),
  normalizedName: varchar("normalizedName", { length: 512 }).notNull(),
  sourceSku: varchar("sourceSku", { length: 128 }),
  packagingSignature: varchar("packagingSignature", { length: 255 }),
  isConfirmed: boolean("isConfirmed").default(true).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("price_supplier_alias_uq").on(table.supplierId, table.normalizedName, table.packagingSignature)]);

export type PriceSupplier = typeof priceSuppliers.$inferSelect;
export type PriceCategory = typeof priceCategories.$inferSelect;
export type PriceProductCharacteristic = typeof priceProductCharacteristics.$inferSelect;
export type PriceLinkGroup = typeof priceLinkGroups.$inferSelect;
export type PriceProduct = typeof priceProducts.$inferSelect;
export type PriceImport = typeof priceImports.$inferSelect;
export type PriceImportRow = typeof priceImportRows.$inferSelect;
export type PriceOfferPrice = typeof priceOfferPrices.$inferSelect;
export type PriceSupplierAlias = typeof priceSupplierAliases.$inferSelect;
