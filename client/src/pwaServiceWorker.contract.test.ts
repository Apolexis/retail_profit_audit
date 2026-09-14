import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entry = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("обновление PWA-оболочки", () => {
  it("проверяет новую версию service worker без использования HTTP-кэша", () => {
    expect(entry).toContain('navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" })');
  });
});
