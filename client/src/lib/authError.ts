export function authErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("требуется локальный вход")) return "Сессия истекла. Введите номер телефона и пароль повторно.";
  if (normalized.includes("неверный логин") || normalized.includes("unauthorized")) return "Неверный номер телефона или пароль.";
  if (normalized.includes("failed query") || normalized.includes("audit_local_accounts") || normalized.includes("database") || normalized.includes("sql")) return "Сервис авторизации обновляется. Повторите попытку через несколько секунд.";
  return "Не удалось выполнить вход. Проверьте соединение и повторите попытку.";
}
