import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(new URL("./evotorPush.ts", import.meta.url), "utf8");
const router = readFileSync(new URL("./routers/inventoryRegistry.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("контур push Эвотор", () => {
  it("хранит только application_id, а ключ остаётся серверным", () => {
    expect(schema).toContain("operationalEvotorPushSettings");
    expect(schema).toContain('mysqlTable("operational_evotor_push_settings"');
    expect(service).toContain("getEvotorApiToken");
    expect(service).not.toContain("EVOTOR_API_TOKEN");
    expect(service).not.toContain("localStorage");
  });

	it("отправляет массовый payload максимум на 100 терминалов и не раскрывает ответ источника", () => {
	  expect(service).toContain("MAX_DEVICES_PER_REQUEST = 100");
	  expect(service).toContain("listEvotorSmartTerminals");
	  expect(service).toContain("terminalUuids: Array.from(new Set(devicesByStoreId.get(evotorStoreId) ?? []))");
	  expect(service).toContain("selected.flatMap(row => row.terminalUuids)");
	  expect(service).toContain('/api/apps/${encodeURIComponent(settings.applicationId)}/push-notifications');
    expect(service).toContain("body: JSON.stringify({ devices: chunk, payload })");
		  expect(service).toContain("MAX_PAYLOAD_CHARACTERS = 1_900");
		  expect(service).toContain('Authorization: `Bearer ${token}`');
		  expect(service).toContain("HTTP ${response.status}");
		  expect(service).not.toContain("await response.text()");
		});

	it("выбирает магазин, а не отдельную кассу", () => {
	  expect(service).toContain("UI deliberately receives store-level counts only");
	  expect(service).toContain("evotorStoreId: _evotorStoreId");
	  expect(service).toContain("terminalCount: terminalUuids.length");
	  expect(service).toContain("Эвотор не вернул кассы для магазина");
	});

  it("требует администратора и создаёт аудит отправки", () => {
    expect(router).toContain("evotorPushSettings");
    expect(router).toContain("evotorPushRecipients");
    expect(router).toContain("setEvotorPushApplication");
    expect(router).toContain("sendEvotorPush");
	    expect(router).toContain("Отправлять push на кассы Эвотор может только администратор.");
	    expect(router).toContain('action: "operational_evotor_push.send"');
	    expect(router).toContain('action: "operational_evotor_push.send_failed"');
	    expect(router).toContain("messageLength: input.message.trim().length");
	    expect(router).toContain("storeIds: input.storeIds ?? null");
	  });
});
