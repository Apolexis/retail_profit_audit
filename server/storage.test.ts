import { describe, expect, it } from "vitest";
import { storagePutKey } from "./storage";

describe("storagePutKey", () => {
  it("preserves ordinary ASCII keys", () => {
    expect(storagePutKey("price-imports/12/source.xlsx")).toBe("price-imports/12/source.xlsx");
  });

  it("converts Cyrillic file names to an opaque ASCII object key", () => {
    const key = storagePutKey("price-imports/12/Прайс рыбный 27.08.26.xlsx");
    expect(key).toMatch(/^price-imports\/12\/[A-Za-z0-9_-]+-[a-f0-9]{12}\.xlsx$/);
    expect(key).not.toContain("Прайс");
  });

  it("does not collide when different non-ASCII names normalize to the same readable stem", () => {
    expect(storagePutKey("price-imports/12/цена.xlsx")).not.toBe(storagePutKey("price-imports/12/цена!.xlsx"));
  });
});
