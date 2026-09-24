import { and, desc, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { localAccounts, operationalEvotorDocuments, operationalRevenuePrintSettings, operationalRevenueRecords, operationalRevenueRecordVersions, stores } from "../drizzle/schema";
import { getDb } from "./db";

export const REVENUE_AMOUNT_FIELDS = [
  "cash",
  "cashless",
  "cashExpenses",
  "householdCash",
  "cleaningCash",
  "salaryCash",
  "serviceCash",
  "extraPaymentCash",
  "bonusCash",
  "vacationCash",
  "utilitiesCash",
  "deliveryCash",
] as const;

export const REVENUE_EXPENSE_FIELDS = [
  "cashExpenses",
  "householdCash",
  "cleaningCash",
  "salaryCash",
  "serviceCash",
  "extraPaymentCash",
  "bonusCash",
  "vacationCash",
  "utilitiesCash",
  "deliveryCash",
] as const;

/** Payroll and utility payments are self-describing in the daily register; the remaining cash expenses require an explanation. */
export const REVENUE_COMMENT_REQUIRED_EXPENSE_FIELDS = [
  "cashExpenses",
  "householdCash",
  "cleaningCash",
  "serviceCash",
  "extraPaymentCash",
  "deliveryCash",
] as const;
const revenueCommentRequiredFieldSet = new Set<string>(REVENUE_COMMENT_REQUIRED_EXPENSE_FIELDS);

export type RevenueAmountField = (typeof REVENUE_AMOUNT_FIELDS)[number];
export type RevenueExpenseField = (typeof REVENUE_EXPENSE_FIELDS)[number];
export type RevenueExpenseComments = Partial<Record<RevenueExpenseField, string>>;
export type RevenueAmounts = Record<RevenueAmountField, number>;
export type RevenueEntryInput = RevenueAmounts & { expenseComments: RevenueExpenseComments };
export type RevenuePrintZebraMode = "none" | "rows" | "columns";
export type RevenuePrintTypography = {
  headingFontSize: number;
  bodyFontSize: number;
  totalFontSize: number;
  headingBold: boolean;
  bodyBold: boolean;
  totalBold: boolean;
};
const revenuePrintTypographyDefaults: RevenuePrintTypography = {
  headingFontSize: 10,
  bodyFontSize: 9,
  totalFontSize: 9,
  headingBold: true,
  bodyBold: false,
  totalBold: true,
};
const validRevenuePrintFontSize = (value: number) => Number.isInteger(value) && value >= 7 && value <= 14;

export function isRevenueExpenseCommentRequired(field: RevenueExpenseField) {
  return revenueCommentRequiredFieldSet.has(field);
}

export const REVENUE_FIELD_LABELS: Record<RevenueAmountField, string> = {
  cash: "Нал",
  cashless: "Б/Нал",
  cashExpenses: "Расходы нал",
  householdCash: "Хоз. нужды нал",
  cleaningCash: "Уборка нал",
  salaryCash: "Зарплата нал",
  serviceCash: "Выслуга нал",
  extraPaymentCash: "Доплата нал",
  bonusCash: "Премия нал",
  vacationCash: "Отпускные нал",
  utilitiesCash: "Коммунальные платежи нал",
  deliveryCash: "Доставка нал",
};

export const emptyRevenueAmounts = (): RevenueAmounts => Object.fromEntries(REVENUE_AMOUNT_FIELDS.map(field => [field, 0])) as RevenueAmounts;

export function calculateOperationalRevenueTotal(input: RevenueAmounts) {
  return REVENUE_AMOUNT_FIELDS.reduce((total, field) => total + input[field], 0);
}

/** Ensures a submitted record can never be read as a financial fact or a free-text expense total. */
export function validateRevenueEntry(input: RevenueEntryInput) {
  for (const field of REVENUE_AMOUNT_FIELDS) {
    const amount = input[field];
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Поле «${REVENUE_FIELD_LABELS[field]}» должно содержать неотрицательную сумму`);
    if (Math.round(amount * 100) !== amount * 100) throw new Error(`Поле «${REVENUE_FIELD_LABELS[field]}» допускает не более двух знаков после точки`);
  }
  const comments: RevenueExpenseComments = {};
  for (const field of REVENUE_EXPENSE_FIELDS) {
    const comment = (input.expenseComments[field] ?? "").trim().replace(/\s+/g, " ");
    if (input[field] > 0 && isRevenueExpenseCommentRequired(field) && !comment) throw new Error(`Для строки «${REVENUE_FIELD_LABELS[field]}» укажите, куда / зачем / за что потрачены наличные`);
    if (input[field] > 0 && comment) comments[field] = comment.slice(0, 500);
  }
  return { ...input, expenseComments: comments };
}

function numericRecord(row: typeof operationalRevenueRecords.$inferSelect): RevenueAmounts {
  return Object.fromEntries(REVENUE_AMOUNT_FIELDS.map(field => [field, Number(row[field])])) as RevenueAmounts;
}

function recordState(row: typeof operationalRevenueRecords.$inferSelect) {
  return {
    storeId: row.storeId,
    businessDate: row.businessDate,
    currentVersion: row.currentVersion,
    isVoided: row.isVoided,
    voidReason: row.voidReason,
    voidedByAccountId: row.voidedByAccountId,
    voidedAt: row.voidedAt,
    ...numericRecord(row),
    expenseComments: (row.expenseComments ?? {}) as RevenueExpenseComments,
    total: calculateOperationalRevenueTotal(numericRecord(row)),
  };
}

function entryColumns(input: RevenueEntryInput) {
  return {
    cash: input.cash.toFixed(2),
    cashless: input.cashless.toFixed(2),
    cashExpenses: input.cashExpenses.toFixed(2),
    householdCash: input.householdCash.toFixed(2),
    cleaningCash: input.cleaningCash.toFixed(2),
    salaryCash: input.salaryCash.toFixed(2),
    serviceCash: input.serviceCash.toFixed(2),
    extraPaymentCash: input.extraPaymentCash.toFixed(2),
    bonusCash: input.bonusCash.toFixed(2),
    vacationCash: input.vacationCash.toFixed(2),
    utilitiesCash: input.utilitiesCash.toFixed(2),
    deliveryCash: input.deliveryCash.toFixed(2),
    expenseComments: input.expenseComments,
  };
}

export type RevenueRegistryFilter = {
  from?: string;
  to?: string;
  storeId?: number;
  storeIds?: number[] | null;
  createdByAccountId?: number;
  limit?: number;
};

export async function listRevenueRecords(input: RevenueRegistryFilter = {}) {
  const db = await getDb();
  if (!db) return [];
  if (Array.isArray(input.storeIds) && !input.storeIds.length) return [];
  const conditions = [
    eq(operationalRevenueRecords.isVoided, false),
    eq(stores.isHidden, false),
    input.from ? gte(operationalRevenueRecords.businessDate, input.from) : undefined,
    input.to ? lte(operationalRevenueRecords.businessDate, input.to) : undefined,
    input.storeId ? eq(operationalRevenueRecords.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalRevenueRecords.storeId, input.storeIds) : undefined,
    input.createdByAccountId ? eq(operationalRevenueRecords.createdByAccountId, input.createdByAccountId) : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({
      id: operationalRevenueRecords.id,
      storeId: operationalRevenueRecords.storeId,
      storeName: stores.name,
      businessDate: operationalRevenueRecords.businessDate,
      createdByAccountId: operationalRevenueRecords.createdByAccountId,
      createdByName: localAccounts.displayName,
      currentVersion: operationalRevenueRecords.currentVersion,
      cash: operationalRevenueRecords.cash,
      cashless: operationalRevenueRecords.cashless,
      cashExpenses: operationalRevenueRecords.cashExpenses,
      householdCash: operationalRevenueRecords.householdCash,
      cleaningCash: operationalRevenueRecords.cleaningCash,
      salaryCash: operationalRevenueRecords.salaryCash,
      serviceCash: operationalRevenueRecords.serviceCash,
      extraPaymentCash: operationalRevenueRecords.extraPaymentCash,
      bonusCash: operationalRevenueRecords.bonusCash,
      vacationCash: operationalRevenueRecords.vacationCash,
      utilitiesCash: operationalRevenueRecords.utilitiesCash,
      deliveryCash: operationalRevenueRecords.deliveryCash,
      expenseComments: operationalRevenueRecords.expenseComments,
      createdAt: operationalRevenueRecords.createdAt,
      updatedAt: operationalRevenueRecords.updatedAt,
    })
    .from(operationalRevenueRecords)
    .innerJoin(stores, eq(operationalRevenueRecords.storeId, stores.id))
    .innerJoin(localAccounts, eq(operationalRevenueRecords.createdByAccountId, localAccounts.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(operationalRevenueRecords.businessDate), desc(operationalRevenueRecords.id))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500));
  return rows.map(row => {
    const amounts = Object.fromEntries(REVENUE_AMOUNT_FIELDS.map(field => [field, Number(row[field])])) as RevenueAmounts;
    return { ...row, ...amounts, expenseComments: (row.expenseComments ?? {}) as RevenueExpenseComments, total: calculateOperationalRevenueTotal(amounts) };
  });
}

/** The revenue sheet is configured separately from request printing and defaults to white paper. */
export async function getOperationalRevenuePrintSettings() {
  const db = await getDb();
  if (!db) return { zebraMode: "none" as const, ...revenuePrintTypographyDefaults };
  const [settings] = await db.select().from(operationalRevenuePrintSettings)
    .orderBy(desc(operationalRevenuePrintSettings.id)).limit(1);
  return settings ?? { zebraMode: "none" as const, ...revenuePrintTypographyDefaults };
}

export async function updateOperationalRevenuePrintSettings(input: { zebraMode: RevenuePrintZebraMode; actorId: number } & RevenuePrintTypography) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  if (![input.headingFontSize, input.bodyFontSize, input.totalFontSize].every(validRevenuePrintFontSize)) throw new Error("Размер шрифта печати должен быть целым числом от 7 до 14 pt.");
  const [before] = await db.select().from(operationalRevenuePrintSettings)
    .orderBy(desc(operationalRevenuePrintSettings.id)).limit(1);
  if (before) {
    await db.update(operationalRevenuePrintSettings)
      .set({ zebraMode: input.zebraMode, headingFontSize: input.headingFontSize, bodyFontSize: input.bodyFontSize, totalFontSize: input.totalFontSize, headingBold: input.headingBold, bodyBold: input.bodyBold, totalBold: input.totalBold, updatedByAccountId: input.actorId })
      .where(eq(operationalRevenuePrintSettings.id, before.id));
  } else {
    await db.insert(operationalRevenuePrintSettings).values({ zebraMode: input.zebraMode, headingFontSize: input.headingFontSize, bodyFontSize: input.bodyFontSize, totalFontSize: input.totalFontSize, headingBold: input.headingBold, bodyBold: input.bodyBold, totalBold: input.totalBold, updatedByAccountId: input.actorId });
  }
  const [after] = await db.select().from(operationalRevenuePrintSettings)
    .orderBy(desc(operationalRevenuePrintSettings.id)).limit(1);
  return { before: before ?? null, after: after! };
}

/**
 * Strictly read-only operational comparison: submitted sales components
 * (cash + cashless) versus the normalized total of SELL documents. Cash
 * expenses never take part; missing receipt coverage remains explicit.
 */
export async function listRevenueEvotorReconciliation(input: RevenueRegistryFilter = {}) {
  const db = await getDb();
  if (!db || (Array.isArray(input.storeIds) && !input.storeIds.length)) return [];
  const records = await listRevenueRecords({ ...input, limit: 500 });
  const conditions = [
    eq(operationalEvotorDocuments.documentType, "SELL"),
    isNotNull(operationalEvotorDocuments.occurredAt),
    eq(stores.isHidden, false),
    input.from ? gte(operationalEvotorDocuments.occurredAt, `${input.from}T00:00:00`) : undefined,
    input.to ? lte(operationalEvotorDocuments.occurredAt, `${input.to}T23:59:59.999`) : undefined,
    input.storeId ? eq(operationalEvotorDocuments.storeId, input.storeId) : undefined,
    Array.isArray(input.storeIds) ? inArray(operationalEvotorDocuments.storeId, input.storeIds) : undefined,
  ].filter(Boolean);
  const documents = await db.select({ storeId: operationalEvotorDocuments.storeId, storeName: stores.name, occurredAt: operationalEvotorDocuments.occurredAt, total: operationalEvotorDocuments.total })
    .from(operationalEvotorDocuments)
    .innerJoin(stores, eq(operationalEvotorDocuments.storeId, stores.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(50_000);
  const receiptTotals = new Map<string, { storeId: number; storeName: string; businessDate: string; total: number; receiptCount: number }>();
  for (const document of documents) {
    if (!document.occurredAt) continue;
    const businessDate = document.occurredAt.slice(0, 10);
    const key = `${document.storeId}:${businessDate}`;
    const current = receiptTotals.get(key) ?? { storeId: document.storeId, storeName: document.storeName, businessDate, total: 0, receiptCount: 0 };
    current.total += Number(document.total ?? 0);
    current.receiptCount += 1;
    receiptTotals.set(key, current);
  }
  const results = new Map<string, { storeId: number; storeName: string; businessDate: string; reportedSales: number | null; evotorSales: number | null; receiptCount: number; difference: number | null; status: "matched" | "underreported" | "overreported" | "missing_receipts" | "not_reported" }>();
  for (const record of records) {
    const key = `${record.storeId}:${record.businessDate}`;
    const receipts = receiptTotals.get(key);
    const reportedSales = Number(record.cash) + Number(record.cashless);
    const evotorSales = receipts?.total ?? null;
    const difference = evotorSales === null ? null : Math.round((reportedSales - evotorSales) * 100) / 100;
    const status = evotorSales === null ? "missing_receipts" : Math.abs(difference ?? 0) <= 0.01 ? "matched" : (difference ?? 0) < 0 ? "underreported" : "overreported";
    results.set(key, { storeId: record.storeId, storeName: record.storeName, businessDate: record.businessDate, reportedSales, evotorSales, receiptCount: receipts?.receiptCount ?? 0, difference, status });
    receiptTotals.delete(key);
  }
  for (const receipt of Array.from(receiptTotals.values())) {
    results.set(`${receipt.storeId}:${receipt.businessDate}`, { storeId: receipt.storeId, storeName: receipt.storeName, businessDate: receipt.businessDate, reportedSales: null, evotorSales: Math.round(receipt.total * 100) / 100, receiptCount: receipt.receiptCount, difference: null, status: "not_reported" });
  }
  return Array.from(results.values()).sort((left, right) => right.businessDate.localeCompare(left.businessDate) || left.storeName.localeCompare(right.storeName, "ru"));
}

export async function getRevenueRecord(recordId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, recordId)).limit(1);
  if (!row) return null;
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, row.storeId)).limit(1);
  const [author] = await db.select({ displayName: localAccounts.displayName }).from(localAccounts).where(eq(localAccounts.id, row.createdByAccountId)).limit(1);
  const amounts = numericRecord(row);
  return { ...row, ...amounts, storeName: store?.name ?? `Магазин #${row.storeId}`, createdByName: author?.displayName ?? `Пользователь #${row.createdByAccountId}`, expenseComments: (row.expenseComments ?? {}) as RevenueExpenseComments, total: calculateOperationalRevenueTotal(amounts) };
}

export async function createRevenueRecord(input: { storeId: number; businessDate: string; createdByAccountId: number; entry: RevenueEntryInput }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const entry = validateRevenueEntry(input.entry);
  const [existing] = await db.select().from(operationalRevenueRecords).where(and(eq(operationalRevenueRecords.storeId, input.storeId), eq(operationalRevenueRecords.businessDate, input.businessDate))).limit(1);
  if (existing && !existing.isVoided) throw new Error("За эту дату по выбранному магазину запись «Выручки» уже передана");
  if (existing?.isVoided) {
    const nextVersion = existing.currentVersion + 1;
    await db.update(operationalRevenueRecords).set({ ...entryColumns(entry), createdByAccountId: input.createdByAccountId, currentVersion: nextVersion, isVoided: false, voidReason: null, voidedByAccountId: null, voidedAt: null }).where(eq(operationalRevenueRecords.id, existing.id));
    const [recreated] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, existing.id)).limit(1);
    if (!recreated) throw new Error("Не удалось прочитать повторно переданную запись «Выручки»");
    await db.insert(operationalRevenueRecordVersions).values({ revenueRecordId: recreated.id, version: nextVersion, action: "recreate", changedByAccountId: input.createdByAccountId, state: recordState(recreated) });
    const recreatedRecord = await getRevenueRecord(recreated.id);
    if (!recreatedRecord) throw new Error("Не удалось получить повторно переданную запись «Выручки»");
    return { ...recreatedRecord, wasRecreated: true };
  }
  const [inserted] = await db.insert(operationalRevenueRecords).values({ storeId: input.storeId, businessDate: input.businessDate, createdByAccountId: input.createdByAccountId, ...entryColumns(entry) }).$returningId();
  const [created] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, inserted.id)).limit(1);
  if (!created) throw new Error("Не удалось прочитать созданную запись «Выручки»");
  await db.insert(operationalRevenueRecordVersions).values({ revenueRecordId: created.id, version: 1, action: "create", changedByAccountId: input.createdByAccountId, state: recordState(created) });
  const createdRecord = await getRevenueRecord(created.id);
  if (!createdRecord) throw new Error("Не удалось получить созданную запись «Выручки»");
  return { ...createdRecord, wasRecreated: false };
}

export async function correctRevenueRecord(input: { recordId: number; changedByAccountId: number; businessDate: string; correctionReason: string; entry: RevenueEntryInput }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const reason = input.correctionReason.trim().replace(/\s+/g, " ");
  if (!reason) throw new Error("Укажите причину исправления записи «Выручки»");
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(input.businessDate)) throw new Error("Выберите дату в формате ГГГГ-ММ-ДД");
  const entry = validateRevenueEntry(input.entry);
  const [before] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, input.recordId)).limit(1);
  if (!before) throw new Error("Запись «Выручки» не найдена");
  if (before.isVoided) throw new Error("Удаленную из рабочего реестра запись нельзя изменить");
  const [conflictingRecord] = await db.select({ id: operationalRevenueRecords.id })
    .from(operationalRevenueRecords)
    .where(and(
      eq(operationalRevenueRecords.storeId, before.storeId),
      eq(operationalRevenueRecords.businessDate, input.businessDate),
      eq(operationalRevenueRecords.isVoided, false),
      ne(operationalRevenueRecords.id, before.id),
    ))
    .limit(1);
  if (conflictingRecord) throw new Error("За новую дату по выбранному магазину уже передана запись «Выручки»");
  const nextVersion = before.currentVersion + 1;
  await db.update(operationalRevenueRecords).set({ ...entryColumns(entry), businessDate: input.businessDate, currentVersion: nextVersion }).where(eq(operationalRevenueRecords.id, before.id));
  const [after] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, before.id)).limit(1);
  if (!after) throw new Error("Не удалось прочитать исправленную запись «Выручки»");
  await db.insert(operationalRevenueRecordVersions).values({ revenueRecordId: after.id, version: nextVersion, action: "correct", changedByAccountId: input.changedByAccountId, correctionReason: reason.slice(0, 500), state: recordState(after) });
  return { before: recordState(before), after: await getRevenueRecord(after.id), correctionReason: reason.slice(0, 500) };
}

/** Removes a mistaken submission from the active register without discarding the immutable version history. */
export async function voidRevenueRecord(input: { recordId: number; changedByAccountId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const reason = input.reason.trim().replace(/\s+/g, " ");
  if (!reason) throw new Error("Укажите причину удаления записи «Выручки»");
  const [before] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, input.recordId)).limit(1);
  if (!before) throw new Error("Запись «Выручки» не найдена");
  if (before.isVoided) throw new Error("Запись «Выручки» уже удалена из рабочего реестра");
  const nextVersion = before.currentVersion + 1;
  await db.update(operationalRevenueRecords).set({ isVoided: true, voidReason: reason.slice(0, 500), voidedByAccountId: input.changedByAccountId, voidedAt: new Date(), currentVersion: nextVersion }).where(eq(operationalRevenueRecords.id, before.id));
  const [after] = await db.select().from(operationalRevenueRecords).where(eq(operationalRevenueRecords.id, before.id)).limit(1);
  if (!after) throw new Error("Не удалось прочитать удаленную запись «Выручки»");
  await db.insert(operationalRevenueRecordVersions).values({ revenueRecordId: after.id, version: nextVersion, action: "void", changedByAccountId: input.changedByAccountId, correctionReason: reason.slice(0, 500), state: recordState(after) });
  return { before: recordState(before), after: recordState(after), reason: reason.slice(0, 500) };
}

export async function listRevenueRecordVersions(recordId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationalRevenueRecordVersions).where(eq(operationalRevenueRecordVersions.revenueRecordId, recordId)).orderBy(desc(operationalRevenueRecordVersions.version));
}
