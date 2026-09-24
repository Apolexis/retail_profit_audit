import { desc, eq } from "drizzle-orm";
import { operationalEvotorPushSettings, operationalStoreMappings, stores } from "../drizzle/schema";
import { getDb } from "./db";
import { listEvotorSmartTerminals } from "./evotorCatalog";
import { getEvotorApiToken } from "./evotorCredentials";

const EVOTOR_API_BASE_URL = "https://api.evotor.ru";
const EVOTOR_MEDIA_TYPE = "application/vnd.evotor.v2+json";
const MAX_DEVICES_PER_REQUEST = 100;
const MAX_PAYLOAD_CHARACTERS = 1_900;

function normalizeApplicationId(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._-]{3,128}$/.test(normalized)) {
    throw new Error("Укажите корректный application_id Эвотор: от 3 до 128 символов, без пробелов.");
  }
  return normalized;
}

function normalizeMessage(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error("Введите текст push-сообщения.");
  if (normalized.length > 1_700) throw new Error("Текст push-сообщения не должен превышать 1 700 символов.");
  const payload = JSON.stringify({ type: "retail_audit_message", text: normalized });
  if (payload.length >= MAX_PAYLOAD_CHARACTERS) throw new Error("Сформированный payload push-сообщения слишком длинный для Эвотор.");
  return { text: normalized, payload: { type: "retail_audit_message", text: normalized } };
}

export async function getOperationalEvotorPushSettings() {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const [row] = await db.select({ applicationId: operationalEvotorPushSettings.applicationId, updatedAt: operationalEvotorPushSettings.updatedAt })
    .from(operationalEvotorPushSettings)
    .orderBy(desc(operationalEvotorPushSettings.updatedAt))
    .limit(1);
  return row ?? { applicationId: null, updatedAt: null };
}

export async function setOperationalEvotorPushApplication(input: { applicationId: string; actorId: number }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const applicationId = normalizeApplicationId(input.applicationId);
  const [before] = await db.select().from(operationalEvotorPushSettings).orderBy(desc(operationalEvotorPushSettings.updatedAt)).limit(1);
  if (before) {
    await db.update(operationalEvotorPushSettings)
      .set({ applicationId, updatedByAccountId: input.actorId })
      .where(eq(operationalEvotorPushSettings.id, before.id));
  } else {
    await db.insert(operationalEvotorPushSettings).values({ applicationId, updatedByAccountId: input.actorId });
  }
  const [after] = await db.select().from(operationalEvotorPushSettings).orderBy(desc(operationalEvotorPushSettings.updatedAt)).limit(1);
  return { before: before ? { applicationId: before.applicationId, updatedAt: before.updatedAt } : null, after: { applicationId: after!.applicationId, updatedAt: after!.updatedAt } };
}

type OperationalEvotorPushRecipient = {
  storeId: number;
  storeName: string;
  evotorStoreId: string;
  terminalUuids: string[];
};

async function resolveOperationalEvotorPushRecipients(): Promise<OperationalEvotorPushRecipient[]> {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const mappings = await db.select({
    storeId: stores.id,
    storeName: stores.name,
    evotorStoreId: operationalStoreMappings.evotorTerminalUuid,
  })
    .from(stores)
    .innerJoin(operationalStoreMappings, eq(operationalStoreMappings.storeId, stores.id))
    .where(eq(stores.isHidden, false))
    .orderBy(stores.name);
  const devices = await listEvotorSmartTerminals();
  const devicesByStoreId = new Map<string, string[]>();
  for (const device of devices) {
    if (!device.storeId) continue;
    const group = devicesByStoreId.get(device.storeId) ?? [];
    group.push(device.id);
    devicesByStoreId.set(device.storeId, group);
  }
  return mappings.flatMap(mapping => {
    const evotorStoreId = mapping.evotorStoreId?.trim();
    if (!evotorStoreId) return [];
    return [{
      storeId: mapping.storeId,
      storeName: mapping.storeName,
      evotorStoreId,
      terminalUuids: Array.from(new Set(devicesByStoreId.get(evotorStoreId) ?? [])),
    }];
  });
}

/** UI deliberately receives store-level counts only: a store choice always means every one of its cash registers. */
export async function listOperationalEvotorPushRecipients() {
  const recipients = await resolveOperationalEvotorPushRecipients();
  return recipients.map(({ terminalUuids, evotorStoreId: _evotorStoreId, ...recipient }) => ({
    ...recipient,
    terminalCount: terminalUuids.length,
  }));
}

export async function sendOperationalEvotorPush(input: { message: string; storeIds?: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("База данных недоступна");
  const { text, payload } = normalizeMessage(input.message);
  const settings = await getOperationalEvotorPushSettings();
  if (!settings.applicationId) throw new Error("Сначала укажите application_id установленного на кассах приложения Эвотор.");

  const mappings = await resolveOperationalEvotorPushRecipients();
  const requestedStoreIds = input.storeIds?.length ? Array.from(new Set(input.storeIds)) : null;
  const selected = requestedStoreIds ? mappings.filter(row => requestedStoreIds.includes(row.storeId)) : mappings;
  if (requestedStoreIds && selected.length !== requestedStoreIds.length) throw new Error("Часть выбранных магазинов не имеет привязки Эвотор.");
  const withoutTerminals = selected.filter(row => !row.terminalUuids.length);
  if (withoutTerminals.length) throw new Error(`Эвотор не вернул кассы для магазина: ${withoutTerminals.map(row => row.storeName).join(", ")}.`);
  if (!selected.length) throw new Error("Нет доступных магазинов Эвотор для отправки push-сообщения.");

  const devices = Array.from(new Set(selected.flatMap(row => row.terminalUuids)));
  const chunks = Array.from({ length: Math.ceil(devices.length / MAX_DEVICES_PER_REQUEST) }, (_, index) => devices.slice(index * MAX_DEVICES_PER_REQUEST, (index + 1) * MAX_DEVICES_PER_REQUEST));
  const token = await getEvotorApiToken();
  const endpoint = `${EVOTOR_API_BASE_URL}/api/apps/${encodeURIComponent(settings.applicationId)}/push-notifications`;
  const requestResults: Array<{ deviceCount: number; status: number }> = [];

  for (const chunk of chunks) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: EVOTOR_MEDIA_TYPE,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ devices: chunk, payload }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error("Эвотор временно недоступен: push-сообщение не отправлено.");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error(`Эвотор не принял доступ приложения для push-сообщения (HTTP ${response.status}).`);
      if (response.status === 404) throw new Error("Эвотор не нашёл application_id или приложение не установлено на выбранных кассах (HTTP 404)." );
      if (response.status === 429) throw new Error("Эвотор временно ограничил частоту push-сообщений (HTTP 429). Повторите позже.");
      throw new Error(`Эвотор не принял push-сообщение (HTTP ${response.status}). Изменения в кассах не выполнялись.`);
    }
    requestResults.push({ deviceCount: chunk.length, status: response.status });
  }

  return {
    applicationId: settings.applicationId,
    messageLength: text.length,
    recipientCount: devices.length,
    storeCount: selected.length,
    storeIds: selected.map(row => row.storeId),
    storeNames: selected.map(row => row.storeName),
    requests: requestResults,
  };
}

export const __evotorPushInternals = { normalizeApplicationId, normalizeMessage, MAX_DEVICES_PER_REQUEST, MAX_PAYLOAD_CHARACTERS };
