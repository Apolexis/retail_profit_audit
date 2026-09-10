import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const notificationsSource = readFileSync(new URL("./notifications.ts", import.meta.url), "utf8");
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
});
