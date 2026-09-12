import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

export type DateRangeValue = { from: string; to: string };
type Theme = "dark" | "light";

const defaultRange: DateRangeValue = { from: "2026-01-01", to: "2026-12-31" };
const pretty = (date: string) => date.split("-").reverse().join(".");
const normalizeRange = (value: DateRangeValue): DateRangeValue => value.from <= value.to ? value : { from: value.to, to: value.from };
const themeIcon = {
  dark: "/manus-storage/rybny_circle_dark_v8_high_detail_transparent_a12b19ba.png",
  light: "/manus-storage/rybny_circle_light_v10_clean_contours_rgba_candidate_3c5f2dad.png",
} as const;
const themeManifest = { dark: "/manifest-dark.webmanifest?v=19", light: "/manifest-light.webmanifest?v=19" } as const;
const storedTheme = () => localStorage.getItem("audit-theme") as Theme | null;
const systemTheme = (): Theme => window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";

type AuditState = {
  selectedStore: string;
  setSelectedStore: (value: string) => void;
  range: DateRangeValue;
  setRange: (value: DateRangeValue) => void;
  theme: Theme;
  toggleTheme: () => void;
  rangeLabel: string;
  months: string[];
  includesMonth: (value: string) => boolean;
};

const AuditContext = createContext<AuditState | null>(null);

/** Applies standalone shell and PWA metadata synchronously without replacing DOM nodes. */
function applyPwaTheme(theme: Theme) {
  const color = theme === "dark" ? "#0c0b12" : "#ffffff";
  const root = document.documentElement;
  const applyMeta = () => {
    const themeColor = document.getElementById("app-theme-color") as HTMLMetaElement | null;
    const statusBar = document.getElementById("app-apple-status-bar-style") as HTMLMetaElement | null;
    if (themeColor) {
      themeColor.setAttribute("content", color);
      themeColor.content = color;
    }
    if (statusBar) {
      const statusStyle = theme === "dark" ? "black-translucent" : "default";
      statusBar.setAttribute("content", statusStyle);
      statusBar.content = statusStyle;
    }
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => meta.setAttribute("content", color));
    document.querySelectorAll<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]').forEach(meta => meta.setAttribute("content", theme === "dark" ? "black-translucent" : "default"));
  };

  localStorage.setItem("audit-theme", theme);
  root.dataset.auditTheme = theme;
  root.dataset.pwaTheme = theme;
  document.body.dataset.auditTheme = theme;
  document.body.dataset.pwaTheme = theme;
  root.style.colorScheme = theme;
  root.style.setProperty("background", color, "important");
  root.style.setProperty("background-color", color, "important");
  root.style.setProperty("--pwa-system-color", color, "important");
  document.body.style.colorScheme = theme;
  document.body.style.setProperty("background", color, "important");
  document.body.style.setProperty("background-color", color, "important");
  document.body.style.setProperty("--pwa-system-color", color, "important");
  applyMeta();
  document.querySelectorAll<HTMLElement>(".packet .packet-top").forEach(header => {
    header.style.setProperty("background", color, "important");
    header.style.setProperty("background-color", color, "important");
    header.style.colorScheme = theme;
  });
  document.getElementById("app-favicon")?.setAttribute("href", themeIcon[theme]);
  document.getElementById("app-apple-touch-icon")?.setAttribute("href", themeIcon[theme]);
  document.getElementById("app-manifest")?.setAttribute("href", themeManifest[theme]);
  window.requestAnimationFrame(applyMeta);
  window.setTimeout(applyMeta, 0);
  window.dispatchEvent(new CustomEvent("audit-pwa-theme-change", { detail: { theme, color } }));
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [selectedStore, setSelectedStore] = useState(() => localStorage.getItem("audit-store") ?? "__all__");
  const [range, setRangeState] = useState<DateRangeValue>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("audit-range") ?? "null") as DateRangeValue | null;
      return stored?.from && stored.to ? normalizeRange(stored) : defaultRange;
    } catch {
      return defaultRange;
    }
  });
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());
  const themeRef = useRef(theme);
  const [location] = useLocation();
  const setRange = (value: DateRangeValue) => setRangeState(normalizeRange(value));

  useEffect(() => { localStorage.setItem("audit-store", selectedStore); }, [selectedStore]);
  useEffect(() => { localStorage.setItem("audit-range", JSON.stringify(range)); }, [range]);
  useLayoutEffect(() => {
    themeRef.current = theme;
    applyPwaTheme(theme);
  }, [theme]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }, [location]);

  const value = useMemo<AuditState>(() => {
    const start = new Date(`${range.from.slice(0, 7)}-01T00:00:00`);
    const end = new Date(`${range.to.slice(0, 7)}-01T00:00:00`);
    const months: string[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    }
    const toggleTheme = () => {
      const next = themeRef.current === "dark" ? "light" : "dark";
      themeRef.current = next;
      applyPwaTheme(next);
      setTheme(next);
    };
    return {
      selectedStore,
      setSelectedStore,
      range,
      setRange,
      theme,
      toggleTheme,
      rangeLabel: `${pretty(range.from)} — ${pretty(range.to)}`,
      months,
      includesMonth: (value: string) => {
        const normalized = value.length === 7 ? value : value.slice(0, 7);
        return normalized >= range.from.slice(0, 7) && normalized <= range.to.slice(0, 7);
      },
    };
  }, [selectedStore, range, theme]);

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (!context) throw new Error("useAudit must be inside AuditProvider");
  return context;
}
