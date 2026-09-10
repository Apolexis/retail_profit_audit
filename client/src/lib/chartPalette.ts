export type ChartTheme = "dark" | "light";

export function chartPalette(theme: ChartTheme) {
  return theme === "light"
    ? { grid: "#D7DDE5", axis: "#667085", tick: "#3F4A5A", dot: "#FFFFFF", median: "#FF375F", bar: "#5E5CE6", selected: "#FF453A" }
    : { grid: "#3a2031", axis: "#b490a2", tick: "#d9c7d0", dot: "#130b12", median: "#ff597c", bar: "#762c4b", selected: "#ffc15e" };
}
