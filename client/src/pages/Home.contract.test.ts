import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/AuditShell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../final-overrides.css", import.meta.url), "utf8");

describe("страница «Сводка»", () => {
  it("показывает вводный управленческий контур выше общего выбора периода", () => {
    expect(home).toContain("Прибыль, запас и риск — в одном управленческом контуре.");
    expect(home).toContain('className="empty-state live-empty home-empty-facts"');
    expect(shell).toContain('analysis-filter${kicker.startsWith("00")');
    expect(shell).toContain('ОБЩИЙ ПЕРИОД');
    expect(shell).toContain('summary-period-filter');
    expect(styles).toContain('.packet .packet-main:has(> .cover) { display: flex; flex-direction: column; }');
    expect(styles).toContain('.packet .packet-main > .cover { order: -1; }');
    expect(styles).toContain('.packet .packet-main:has(> .cover) > .summary-period-filter { margin-top: 16px !important; }');
  });
});
