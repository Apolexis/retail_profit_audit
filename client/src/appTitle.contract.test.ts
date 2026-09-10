import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const appTitle = "Аналитика «Рыбный»";

it("сохраняет утвержденное название приложения в окружении и тематических PWA manifest", () => {
  expect(process.env.VITE_APP_TITLE).toBe(appTitle);

  const manifestPath = resolve(process.cwd(), "client/public/manifest.webmanifest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string; short_name: string };
  const worker = readFileSync(resolve(process.cwd(), "client/public/service-worker.js"), "utf8");
  expect(manifest.name).toBe(appTitle);
  expect(manifest.short_name).toBe("Рыбный");
  expect(worker).toContain('const CACHE_NAME = "rybny-analytics-shell-v14"');
  expect(worker.match(/const CACHE_NAME/g)).toHaveLength(1);
  const iconsByTheme: Record<string, string | undefined> = {};
  const expectedIconByManifest={"manifest-dark.webmanifest":"/manus-storage/rybny_circle_dark_v45_dc39f0c9.png","manifest-light.webmanifest":"/manus-storage/rybny_circle_light_v45_94fe9f81.png"} as const;
  ["manifest-dark.webmanifest", "manifest-light.webmanifest"].forEach(file => {
    const themed = JSON.parse(readFileSync(resolve(process.cwd(), "client/public", file), "utf8")) as { name: string; short_name: string; icons: Array<{src:string;purpose:string}> };
    expect(themed.name).toBe(appTitle);
    expect(themed.short_name).toBe("Рыбный");
    expect(themed.icons[0]?.src).toBe(expectedIconByManifest[file]);
    expect(themed.icons[0]?.purpose).toBe("any");
    expect(themed.icons.every(icon=>icon.purpose==="any")).toBe(true);
    iconsByTheme[file] = themed.icons[0]?.src;
  });
  expect(iconsByTheme["manifest-dark.webmanifest"]).not.toBe(iconsByTheme["manifest-light.webmanifest"]);
});
