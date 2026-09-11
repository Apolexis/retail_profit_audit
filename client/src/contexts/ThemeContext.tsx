import React, { createContext, useContext, useEffect, useState } from "react";

const touchHoverQuery = "(hover: none), (pointer: coarse)";

function splitTopLevelSelectors(value: string) {
  const selectors: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";
  for (const character of value) {
    if (quote) {
      current += character;
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

/**
 * Mobile Safari can retain :hover after a tap. Instead of overriding colours,
 * remove only hover selectors from loaded local rules while a touch input is active.
 * Rules paired with :focus-visible keep their keyboard-accessible selector intact.
 */
function useTouchHoverGuard() {
  useEffect(() => {
    const media = window.matchMedia(touchHoverQuery);
    const originalSelectors = new Map<CSSStyleRule, string>();

    const restore = () => {
      originalSelectors.forEach((selector, rule) => {
        try {
          rule.selectorText = selector;
        } catch {
          // A development stylesheet can disappear during HMR; there is nothing to restore.
        }
      });
      originalSelectors.clear();
      document.documentElement.removeAttribute("data-touch-hover-disabled");
    };

    const disableHoverSelectors = (rules: CSSRuleList) => {
      Array.from(rules).forEach(rule => {
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(":hover")) {
          const original = rule.selectorText;
          const preserved = splitTopLevelSelectors(original)
            .filter(selector => !selector.includes(":hover"))
            .join(", ");
          originalSelectors.set(rule, original);
          rule.selectorText = preserved || ".touch-hover-rule-disabled";
          return;
        }
        if ("cssRules" in rule) {
          try {
            disableHoverSelectors((rule as CSSGroupingRule).cssRules);
          } catch {
            // Ignore inaccessible third-party stylesheet groups.
          }
        }
      });
    };

    const sync = () => {
      restore();
      if (!media.matches) return;
      document.documentElement.dataset.touchHoverDisabled = "true";
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          disableHoverSelectors(sheet.cssRules);
        } catch {
          // Cross-origin sheets are not required for the app interface.
        }
      });
    };

    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      restore();
    };
  }, []);
}

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  useTouchHoverGuard();
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
