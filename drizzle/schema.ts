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
  createdByAccountId: int("createdByAccountId").notNull(),
  closedByAccountId: int("closedByAccountId"),
  closedAt: timestamp("closedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [unique("operational_inventory_store_date_uq").on(table.storeId, table.businessDate)]);

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

/** Immutable stock adjustments are emitted solely on closing an inventory. */
export const operationalStockMovements = mysqlTable("operational_stock_movements", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  inventoryId: int("inventoryId").notNull(),
  kind: mysqlEnum("kind", ["first_count", "inventory_adjustment"]).notNull(),
  previousQuantity: decimal("previousQuantity", { precision: 16, scale: 3 }).notNull(),
  countedQuantity: decimal("countedQuantity", { precision: 16, scale: 3 }).notNull(),
  quantityDelta: decimal("quantityDelta", { precision: 16, scale: 3 }).notNull(),
  unit: mysqlEnum("unit", ["kg", "l", "piece"]).notNull(),
  createdByAccountId: int("createdByAccountId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [unique("operational_stock_movement_inventory_product_uq").on(table.inventoryId, table.productId)]);

export type OperationalInventory = typeof operationalInventories.$inferSelect;
export type OperationalInventoryLine = typeof operationalInventoryLines.$inferSelect;
export type OperationalStockMovement = typeof operationalStockMovements.$inferSelect;

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

/** The internal code is the durable target for supplier aliases and later ERP integrations. */
export const priceProducts = mysqlTable("price_products", {
  id: int("id").autoincrement().primaryKey(),
  internalCode: varchar("internalCode", { length: 64 }).notNull().unique(),
  canonicalName: varchar("canonicalName", { length: 255 }).notNull(),
  normalizedSignature: varchar("normalizedSignature", { length: 512 }).notNull().unique(),
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
export type PriceProduct = typeof priceProducts.$inferSelect;
export type PriceImport = typeof priceImports.$inferSelect;
export type PriceImportRow = typeof priceImportRows.$inferSelect;
export type PriceOfferPrice = typeof priceOfferPrices.$inferSelect;
export type PriceSupplierAlias = typeof priceSupplierAliases.$inferSelect;
