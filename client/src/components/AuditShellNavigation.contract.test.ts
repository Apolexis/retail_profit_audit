import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const shell=readFileSync(resolve(process.cwd(),"client/src/components/AuditShell.tsx"),"utf8");
const css=readFileSync(resolve(process.cwd(),"client/src/final-overrides.css"),"utf8");
const design=readFileSync(resolve(process.cwd(),"client/src/design-system.css"),"utf8");

describe("AuditShell navigation contract",()=>{
  it("groups routes by clear management purpose without removing them",()=>{
    expect(shell).toContain('title:"АНАЛИТИКА"');
    expect(shell).toContain('title:"РЕШЕНИЯ"');
    expect(shell).toContain('title:"УПРАВЛЕНИЕ"');
    expect(shell).toContain('["/cadence","08","Ритм",false]');
    expect(shell).toContain('["/reports","18","Отчеты",true]');
    expect(shell).toContain('const profileItem=["/profile","14","Профиль",false]');
  });

  it("uses the same visible grouped routes in desktop and mobile navigation",()=>{
    expect(shell).toContain('"nav-section is-open":"nav-section"');
    expect(shell).toContain('"nav-drawer-section is-open":"nav-drawer-section"');
    expect(css).toContain(".packet .nav-section + .nav-section");
    expect(css).toContain(".packet .nav-drawer-section + .nav-drawer-section");
  });

  it("lets the user collapse any group, including the active one",()=>{
    expect(shell).toContain("const sectionIsOpen=");
    expect(shell).toContain("Object.hasOwn(expandedSections,section.title)?Boolean(expandedSections[section.title]):sectionIsActive(section.items)");
    expect(shell).toContain("const toggleSection=(title:string,defaultOpen:boolean)");
    expect(shell).toContain("Object.hasOwn(current,title)?Boolean(current[title]):defaultOpen");
    expect(shell).toContain("toggleSection(section.title,sectionIsActive(section.items))");
    expect(shell).toContain('className="nav-section-trigger"');
    expect(shell).toContain('className="nav-drawer-section-trigger"');
    expect(shell).toContain('aria-expanded={open}');
    expect(css).toContain(".packet .nav-section:not(.is-open) .nav-section-links");
    expect(css).toContain(".packet .nav-drawer-section:not(.is-open) .nav-drawer-section-links");
    expect(shell).toContain("packet-profile-link");
    expect(shell).toContain("drawer-profile-link");
  });

  it("does not render ordinal numbers beside page titles",()=>{
    expect(shell).toContain('section.items.map(([href,,label])');
    expect(shell).not.toContain('<b>{number}</b>');
    expect(shell).not.toContain('<b>{profileItem[1]}</b>');
    expect(shell).toContain('kicker.replace(/^\\d+\\s*\\/\\s*/,"")');
  });

  it("uses the agreed theme-aware compact brand mark in navigation and login",()=>{
    expect(shell).toContain('const compactBrandIcon={dark:"/manus-storage/rybny_pwa_dark_transparent_110da59a.png",light:"/manus-storage/rybny_pwa_light_transparent_d1223d9d.png"} as const;');
    expect(shell).toContain('className="brand-mark-switch"');
    expect(shell).toContain('(["dark","light"] as const).map(markTheme');
    expect(shell).toContain('loading="eager" decoding="sync"');
    expect(shell).not.toContain('<img key={theme} className="brand-mark"');
    expect(shell).toContain('className="brand-title"');
    expect(shell).not.toContain("rybny_analytics_app_icon");
  });

  it("keeps notification and theme controls visually unified in the dark header",()=>{
    expect(css).toContain(".packet .packet-actions :is(.alert-link, .theme-button)");
    expect(css).toContain("color: #ff937f !important");
    expect(css).toContain(".packet .packet-actions :is(.alert-link, .theme-button):hover");
  });

  it("uses a blue ordinary hover and focus state for light drawer navigation",()=>{
    expect(css).toContain('html[data-audit-theme="light"] .packet .nav-drawer-section .drawer-link:hover');
    expect(css).toContain('border-color: #0a63c8; background: #edf6ff; color: #075dbb;');
    expect(css).toContain('box-shadow: inset 2px 0 #0a63c8; color: #075dbb;');
  });
});
