import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const appTitle = "Аналитика «Рыбный»";

it("сохраняет утвержденное название приложения в окружении и тематических PWA manifest", () => {
  expect(process.env.VITE_APP_TITLE).toBe(appTitle);

  const manifestPath = resolve(process.cwd(), "client/public/manifest.webmanifest");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string; short_name: string };
  const worker = readFileSync(resolve(process.cwd(), "client/public/service-worker.js"), "utf8");
  const index = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
  expect(manifest.name).toBe(appTitle);
  expect(manifest.short_name).toBe("Рыбный");
  expect(worker).toContain('const CACHE_NAME = "rybny-analytics-shell-v19"');
  expect(worker.match(/const CACHE_NAME/g)).toHaveLength(1);
  expect(index).toContain('id="app-theme-color" name="theme-color" content="#f2f2f7"');
  expect(index).toContain('apple-mobile-web-app-status-bar-style" content="default"');
  const iconsByTheme: Record<string, string | undefined> = {};
  const expectedIconByManifest={"manifest-dark.webmanifest":"/manus-storage/rybny_circle_dark_v8_high_detail_transparent_a12b19ba.png","manifest-light.webmanifest":"/manus-storage/rybny_circle_light_v10_clean_contours_rgba_candidate_3c5f2dad.png"} as const;
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
