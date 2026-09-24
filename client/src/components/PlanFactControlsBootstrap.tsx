import { useEffect } from "react";

/** Открывает нативный выбор месяца по клику в любую точку поля «План‑факта», а не только по иконке. */
export function PlanFactControlsBootstrap() {
  useEffect(() => {
    const openMonthPicker = (event: MouseEvent) => {
      const input = (event.target as Element | null)?.closest<HTMLInputElement>(".plan-editor input[type='month']");
      if (!input) return;
      input.showPicker?.();
    };
    document.addEventListener("click", openMonthPicker);
    return () => document.removeEventListener("click", openMonthPicker);
  }, []);
  return null;
}
