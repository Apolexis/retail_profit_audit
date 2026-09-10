import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const appTitle = "Аналитика «Рыбный»";

it("сохраняет утвержденное название приложения в окружении и PWA manifest", () => {
  expect(process.env.VITE_APP_TITLE).toBe(appTitle);

  const manifestPath = resolve(process.cwd(), "client/public/manifest.webmanifest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string; short_name: string };
  expect(manifest.name).toBe(appTitle);
  expect(manifest.short_name).toBe("Рыбный");
});
