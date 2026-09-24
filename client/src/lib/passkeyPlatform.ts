export type PasskeyPlatform = "android" | "ios" | "macos" | "windows" | "other";

export function getPasskeyPlatform(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): PasskeyPlatform {
  const agent = userAgent.toLowerCase();
  if (/android/.test(agent)) return "android";
  if (/iphone|ipad|ipod/.test(agent)) return "ios";
  if (/macintosh|mac os/.test(agent)) return "macos";
  if (/windows/.test(agent)) return "windows";
  return "other";
}

export function passkeyPlatformGuidance(platform: PasskeyPlatform) {
  switch (platform) {
    case "android":
      return "Android: после подготовки нажмите «Подтвердить ключ на устройстве». Должен открыться системный менеджер ключей, затем PIN, отпечаток или лицо. Если окно не появляется, откройте сайт в Chrome по основному адресу приложения.";
    case "ios":
      return "iPhone или iPad: после подготовки подтвердите ключ с Face ID, Touch ID или кодом устройства.";
    case "macos":
      return "Mac: после подготовки подтвердите ключ с Touch ID, паролем пользователя или ключом iCloud.";
    case "windows":
      return "Windows: после подготовки подтвердите ключ с Windows Hello, PIN или ключом безопасности.";
    default:
      return "После подготовки подтвердите ключ способом, который предложит устройство.";
  }
}
