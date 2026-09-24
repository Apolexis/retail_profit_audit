import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("оставляет наличные траты и НДФЛ самостоятельными карточками порогов", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const overrides = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");
  expect(page).toContain('className="threshold-grid threshold-grid-cash"');
  expect(page).not.toContain('className="threshold-control-group"');
  expect(page).toContain('cashControlRules.map(rule => <ThresholdRuleCard');
  expect(overrides).toContain('html[data-audit-theme="light"] .packet .threshold-rule .threshold-amount > span { color: #61728a !important; }');
});

it("настраивает процентный порог отклонения наценки с дробным шагом", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  expect(page).toContain('const step = rule.unit === "₽" ? 100 : 0.5;');
  expect(page).toContain('inputMode="decimal"');
  expect(page).toContain('threshold: event.target.value.replace(/[^0-9.,]/g, "")');
});

it("ведет из блока непрочитанных к первому непрочитанному событию", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  expect(page).toContain('const firstUnreadRef = useRef<HTMLElement | null>(null);');
  expect(page).toContain('const revealFirstUnread = () => {');
  expect(page).toContain('target.scrollIntoView({ behavior: "smooth", block: "center" });');
  expect(page).toContain('className="packet-kpi notification-unread-kpi"');
  expect(page).toContain("notification-first-unread");
});

it("ведет из сигнала изменения цены поставщика в прайс‑контроль", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  expect(page).toContain('item.entityType === "price"');
  expect(page).toContain('setLocation("/price-control")');
  expect(page).toContain('"Открыть прайс‑контроль"');
});

it("показывает выполненный операционный дедлайн в истории без повторного тревожного статуса", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const theme = readFileSync(resolve(process.cwd(), "client/src/theme-refresh.css"), "utf8");
  expect(page).toContain('item.resolvedAt && <span className="notification-resolved">');
  expect(page).toContain("Выполнено");
  expect(theme).toContain(".notification-resolved");
});

it("ведет из контроля избыточного запаса в реестр остатков", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  expect(page).toContain('item.entityId?.startsWith("overstock_cover:") || item.entityId?.startsWith("evotor_stock_freshness:")');
  expect(page).toContain('"Открыть остатки"');
});

it("открывает первоисточник по сигналам свежести Эвотор и обновляет ленту", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  expect(page).toContain('item.entityId?.startsWith("evotor_receipt_freshness:") ? "/evotor-sales/receipts"');
  expect(page).toContain('item.entityId?.startsWith("evotor_stock_freshness:")');
  expect(page).toContain('"Открыть чеки Эвотор"');
  expect(page).toContain("refetchInterval: 60_000");
});

it("сохраняет читаемые цели рассылки и темные контуры checkbox", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const overrides = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");
  expect(page).toContain('className="broadcast-target-row"');
  expect(page).toContain('<div className="broadcast-target-row"><span>Получатели</span><div className="broadcast-target-buttons"');
  expect(overrides).toContain('.packet .broadcast-target-buttons button { min-width: 0;');
  expect(overrides).toContain('.packet .admin-broadcast .broadcast-target-row {');
  expect(overrides).toContain('.packet .admin-broadcast .broadcast-targeting > label {');
  expect(overrides).toContain('.packet .admin-broadcast .admin-broadcast-actions .packet-link {');
  expect(overrides).toContain('min-width: 156px;');
  expect(overrides).toContain('.packet .admin-broadcast .stack-form textarea:focus {');
  expect(overrides).toContain('box-shadow: none !important;');
  expect(overrides).toContain('@media (hover: hover) and (pointer: fine) { .packet .broadcast-target-buttons button:hover');
  expect(overrides).toContain('html[data-audit-theme="dark"] .packet .threshold-enabled input[type="checkbox"]');
  expect(overrides).toContain('border: 1px solid rgb(39, 49, 67) !important;');
});

it("собирает отправку на кассы Эвотор рядом с сообщениями пользователям", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const overrides = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");
  expect(page).toContain('className="packet-card admin-broadcast evotor-push-control"');
  expect(page).toContain("evotorPushSettings.useQuery");
  expect(page).toContain("evotorPushRecipients.useQuery");
  expect(page).toContain("setEvotorPushApplication.useMutation");
  expect(page).toContain("sendEvotorPush.useMutation");
  expect(page).toContain("При выборе магазина сообщение направляется на все обнаруженные кассы точки.");
  expect(page).toContain("Отправить всем кассам");
  expect(page).toContain("Отправить во все кассы магазина");
  expect(page).not.toContain("Отправить на выбранную кассу");
  expect(overrides).toContain(".packet .evotor-push-control .admin-broadcast-actions .packet-link");
  expect(overrides).toContain("white-space: normal;");
});

it("заменяет флажок порога на общий тумблер", () => {
  const page = readFileSync(resolve(process.cwd(), "client/src/pages/Notifications.tsx"), "utf8");
  const overrides = readFileSync(resolve(process.cwd(), "client/src/final-overrides.css"), "utf8");
  expect(page).toContain('className="threshold-enabled threshold-switch"');
  expect(page).toContain('className="threshold-switch-track"');
  expect(overrides).toContain(".packet .threshold-switch-track");
});
