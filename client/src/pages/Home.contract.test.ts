import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Сводка»", () => {
  it("показывает вводный управленческий контур выше общего выбора периода", () => {
    expect(home).toContain("Прибыль, запас и риск — в одном управленческом контуре.");
    expect(shell).toContain('className="analysis-filter"');
    expect(styles).toContain('.packet .packet-main:has(> .cover) { display: flex; flex-direction: column; }');
    expect(styles).toContain('.packet .packet-main > .cover { order: -1; }');
  });
});
