import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const notificationsSource = readFileSync(new URL("./notifications.ts", import.meta.url), "utf8");
const accessControlSource = readFileSync(new URL("./accessControl.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/localAuth.ts", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("../client/src/components/AuditShell.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Notifications.tsx", import.meta.url), "utf8");

describe("компактная выдача уведомлений", () => {
  it("ограничивает страницу истории и отдает курсор следующей страницы", () => {
    expect(notificationsSource).toContain("limit(limit + 1)");
    expect(notificationsSource).toContain("nextCursor");
    expect(notificationsSource).toContain("lt(auditNotifications.id, input.cursor)");
  });

  it("предоставляет отдельные серверные процедуры сводки и массового прочтения", () => {
    expect(routerSource).toContain("notificationSummary:");
    expect(routerSource).toContain("markAllNotificationsRead:");
    expect(notificationsSource).toContain("markAllNotificationsRead");
  });

  it("не загружает ленту уведомлений в оболочке и дает пользователю постраничную историю", () => {
    expect(shellSource).toContain("notificationSummary.useQuery");
    expect(shellSource).not.toContain("localAuth.notifications.useQuery");
    expect(pageSource).toContain("notifications.useInfiniteQuery");
    expect(pageSource).toContain("Прочитать все");
    expect(pageSource).toContain("Показать еще");
  });

  it("отделяет ручную рассылку администратора от обычных информационных событий", () => {
    expect(routerSource).toContain("adminBroadcast:");
    expect(routerSource).toContain("localAdminFromContext");
    expect(routerSource).toContain('entityType:"admin_broadcast"');
    expect(routerSource).toContain("pushSubscriptionsAccepted");
    expect(notificationsSource).toContain('input.entityType==="admin_broadcast"');
  });

  it("доставляет операционный дедлайн назначенному продавцу без расширения финансовых событий", () => {
    expect(notificationsSource).toContain("createOperationalSignalNotifications");
    expect(notificationsSource).toContain("getOperationalSignalRecipients");
    expect(accessControlSource).toContain('role === "seller"');
    expect(accessControlSource).not.toContain('role === "admin" || role === "analyst" || role === "seller"');
    expect(accessControlSource).toContain('if (!storeIds.length) return [];');
    expect(accessControlSource).toContain("getAlertRecipients");
  });

  it("закрывает выполненный дедлайн в истории, не удаляя аудиторскую запись", () => {
    expect(notificationsSource).toContain("resolveOperationalSignalNotifications");
    expect(notificationsSource).toContain("resolvedAt: new Date()");
    expect(notificationsSource).toContain("isNull(auditNotifications.resolvedAt)");
  });

  it("строит мобильную ссылку на конкретный возврат Эвотор", () => {
    expect(notificationsSource).toContain('entityId?.match(/^evotor_return:(\\d+)$/)');
    expect(notificationsSource).toContain('`/evotor-sales/receipts?receipt=${entityId.split(":")[1]}`');
    expect(pageSource).toContain('item.entityId?.startsWith("evotor_return:") ? "Открыть возврат"');
    expect(pageSource).toContain('item.entityId?.match(/^evotor_return:(\\d+)$/)?.[1]');
    expect(notificationsSource).toContain("createReturnSignalNotifications");
    expect(accessControlSource).toContain("getReturnSignalRecipients");
    expect(accessControlSource).toContain('grant.role === "seller" || grant.role === "manager" || grant.role === "admin"');
  });

	it("направляет контроль покрытия запаса административным получателям, а не продавцам", () => {
	  expect(notificationsSource).toContain("createStockCoverSignalNotifications");
	  expect(notificationsSource).toContain("return createStoreEventNotifications(input);");
	  expect(notificationsSource).toContain('entityId?.startsWith("overstock_cover:")||entityId?.startsWith("evotor_stock_freshness:")');
	  expect(pageSource).toContain('item.entityId?.startsWith("overstock_cover:") || item.entityId?.startsWith("evotor_stock_freshness:") ? "/stock-control"');
	  expect(pageSource).toContain('item.entityType === "operational_signal" && (item.entityId?.startsWith("overstock_cover:") || item.entityId?.startsWith("evotor_stock_freshness:")) ? "Открыть остатки"');
  });

	it("адресует срок партии руководителю и магазину, а срок БМ/СРС — только управлению", () => {
	  expect(notificationsSource).toContain("createExpirySignalNotifications");
	  expect(notificationsSource).toContain("createWarehouseExpirySignalNotifications");
    expect(notificationsSource).toContain('entityId?.startsWith("expiry_")?"/notifications"');
    expect(accessControlSource).toContain("getExpirySignalRecipients");
    expect(accessControlSource).toContain('grant.role === "seller" || grant.role === "manager" || grant.role === "admin"');
    expect(accessControlSource).toContain("getWarehouseExpirySignalRecipients");
    expect(pageSource).toContain('item.entityId?.startsWith("expiry_") ? "/notifications"');
	  expect(pageSource).toContain('item.entityId?.startsWith("expiry_") ? null');
	});

	it("ограничивает socket ожидание push, чтобы delivery не блокировал current-day intake", () => {
	  expect(notificationsSource).toContain("const PUSH_SOCKET_TIMEOUT_MS = 8_000");
	  expect(notificationsSource).toContain("timeout:PUSH_SOCKET_TIMEOUT_MS");
	  expect(notificationsSource).toContain("TTL:60");
	});

	it("сводит mobile delivery freshness в один digest без потери отдельных in-app сигналов", () => {
	  expect(notificationsSource).toContain("sendMobilePush?: boolean");
	  expect(notificationsSource).toContain("const { sendMobilePush: shouldSendMobilePush = true, ...notification } = input;");
	  expect(notificationsSource).toContain("createDataFreshnessSignalNotificationsBatch");
	  expect(accessControlSource).toContain("getDataFreshnessSignalRecipientsByStore");
	  expect(notificationsSource).toContain("sendDataFreshnessMobileDigest");
	  expect(notificationsSource).toContain("evotor_freshness_digest:");
	});
});
