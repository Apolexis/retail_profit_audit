import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const staticServer = readFileSync(new URL("./_core/vite.ts", import.meta.url), "utf8");

describe("production static assets", () => {
  it("publishes hashed Vite assets at the static root instead of a nested assets folder", () => {
    expect(viteConfig).toContain('outDir: path.resolve(import.meta.dirname, "dist/public")');
    expect(viteConfig).toContain('assetsDir: "."');
  });

  it("serves the production build before the SPA index fallback", () => {
    expect(staticServer).toContain("app.use(express.static(distPath));");
    expect(staticServer).toContain('res.sendFile(path.resolve(distPath, "index.html"));');
  });
});
