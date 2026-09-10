export function getPwaInstallGuide(userAgent: string, maxTouchPoints = 0) {
  const agent = userAgent.toLowerCase();
  const isIPadDesktopAgent = agent.includes("macintosh") && maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(agent) || isIPadDesktopAgent) {
    return "На iPhone или iPad в Safari нажмите «Поделиться», затем выберите: На экран «Домой», и подтвердите добавление.";
  }

  if (agent.includes("android")) {
    return "На Android откройте меню браузера ⋮. Выберите «Установить приложение» или «Добавить на главный экран», если такая команда доступна. Если команды нет, откройте сайт в Chrome.";
  }

  return "Откройте сайт в браузере телефона или планшета. Если браузер поддерживает установку, в его меню появится команда «Установить приложение» или «Добавить на главный экран».";
}
