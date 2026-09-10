export function passkeyErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("notallowederror") || normalized.includes("not allowed") || normalized.includes("timed out") || normalized.includes("aborterror") || normalized.includes("aborted")) {
    return "Подтверждение ключа доступа отменено или не выполнено. Попробуйте еще раз.";
  }
  if (normalized.includes("not supported") || normalized.includes("not implemented") || normalized.includes("notsupportederror")) {
    return "На этом устройстве быстрый вход не поддерживается. Используйте телефон и пароль.";
  }
  if (normalized.includes("rp id") || normalized.includes("origin") || normalized.includes("securityerror")) {
    return "Быстрый вход доступен только по тому же защищенному адресу, на котором он был включен. Откройте приложение по основному адресу и повторите попытку.";
  }
  if (normalized.includes("invalidstateerror") || normalized.includes("constraint")) {
    return "Этот ключ быстрого входа недоступен на устройстве. Войдите по телефону и паролю, затем включите быстрый вход заново в профиле.";
  }
  if (normalized.includes("network") || normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
    return "Не удалось связаться с приложением. Проверьте соединение и повторите попытку.";
  }
  if (normalized.includes("too_small") || normalized.includes("expected string to have") || normalized.includes("phone")) {
    return "Не удалось прочитать номер телефона. Введите его полностью или нажмите «Войти с ключом доступа» без номера.";
  }
  return "Не удалось подтвердить быстрый вход. Используйте телефон и пароль, затем при необходимости включите быстрый вход заново в профиле.";
}
