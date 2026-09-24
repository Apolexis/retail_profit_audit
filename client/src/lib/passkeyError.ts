import { type PasskeyPlatform } from "@/lib/passkeyPlatform";

export function passkeyErrorText(error: unknown, platform: PasskeyPlatform = "other") {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("notallowederror") || normalized.includes("not allowed") || normalized.includes("timed out") || normalized.includes("aborterror") || normalized.includes("aborted")) {
    if (platform === "android") return "Android не открыл системное подтверждение ключа или оно было закрыто. Откройте приложение в Chrome по основному адресу, убедитесь, что установлен блокировочный PIN, и после подготовки нажмите «Подтвердить ключ на устройстве». Телефон и пароль остаются резервным входом.";
    if (platform === "ios") return "iPhone или iPad не открыл системное подтверждение ключа или оно было закрыто. Разблокируйте устройство и повторите: появится Face ID, Touch ID или код устройства. Телефон и пароль остаются резервным входом.";
    if (platform === "macos") return "Mac не открыл системное подтверждение ключа или оно было закрыто. Разблокируйте устройство и повторите: появится Touch ID, пароль пользователя или ключ iCloud. Телефон и пароль остаются резервным входом.";
    if (platform === "windows") return "Windows не открыл системное подтверждение ключа или оно было закрыто. Повторите попытку и подтвердите Windows Hello, PIN или ключ безопасности. Телефон и пароль остаются резервным входом.";
    return "Устройство не открыло системное подтверждение ключа доступа или оно было закрыто. Разблокируйте устройство и повторите. Телефон и пароль остаются резервным входом.";
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
