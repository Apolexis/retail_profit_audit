import { useEffect } from "react";
import { normalizeDecimalInputText } from "@/lib/utils";

export function isEditableDecimalInput(element: EventTarget | null): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  return element.inputMode === "decimal" || element.type === "number" || element.dataset.decimalInput === "true";
}

export function normalizeDecimalInputElement(input: HTMLInputElement) {
  if (!input.value.includes(",")) return false;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const prefix = start === null ? null : input.value.slice(0, start);
  input.value = normalizeDecimalInputText(input.value);
  if (start !== null && end !== null) {
    const nextStart = prefix === null ? start : normalizeDecimalInputText(prefix).length;
    const nextEnd = nextStart + Math.max(0, end - start);
    try {
      input.setSelectionRange(nextStart, nextEnd);
    } catch {
      /* Some input types do not support manual selection. */
    }
  }
  return true;
}

export function DecimalInputNormalizerBootstrap() {
  useEffect(() => {
    const normalize = (event: Event) => {
      if (isEditableDecimalInput(event.target)) normalizeDecimalInputElement(event.target);
    };
    document.addEventListener("input", normalize, true);
    document.addEventListener("change", normalize, true);
    return () => {
      document.removeEventListener("input", normalize, true);
      document.removeEventListener("change", normalize, true);
    };
  }, []);
  return null;
}
