import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shell=readFileSync(resolve(process.cwd(),"client/src/components/AuditShell.tsx"),"utf8");

describe("PWA fixed controls after application return",()=>{
  it("перемонтирует нижнюю навигацию после pageshow, visibilitychange, focus и изменения visualViewport",()=>{
    expect(shell).toContain('const [fixedEpoch,setFixedEpoch]=useState(0);');
    expect(shell).toContain('window.visualViewport');
    expect(shell).toContain('window.addEventListener("pageshow",refreshFixedControls)');
    expect(shell).toContain('window.addEventListener("focus",refreshFixedControls)');
    expect(shell).toContain('document.addEventListener("visibilitychange",onVisible)');
    expect(shell).toContain('key={`mobile-quick-nav-${fixedEpoch}`}');
    expect(shell).toContain('key={`scroll-top-${fixedEpoch}`}');
  });
});
