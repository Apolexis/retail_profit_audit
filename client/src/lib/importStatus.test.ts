import { describe, expect, it } from "vitest";
import { importStatusMeta, isImportBusy } from "./importStatus";

describe("статусы импорта", () => {
  it("показывает последовательность от чтения до завершения", () => {
    expect(importStatusMeta.reading.step).toBe(1);
    expect(importStatusMeta.checking.step).toBe(2);
    expect(importStatusMeta.ready.check).toBe("предпросмотр готов");
    expect(importStatusMeta.saving.write).toBe("сохраняем выбранные даты");
    expect(importStatusMeta.done.write).toBe("готово");
  });

  it("помечает только фактически выполняемые этапы", () => {
    expect(isImportBusy("reading")).toBe(true);
    expect(isImportBusy("checking")).toBe(true);
    expect(isImportBusy("saving")).toBe(true);
    expect(isImportBusy("ready")).toBe(false);
    expect(isImportBusy("done")).toBe(false);
  });
});
