import { useEffect } from "react";
import { compareTableValues, numericTableValue, type SortDirection } from "@/lib/tableSorting";

const tableSelector = "table.data-table";

function hydrateTable(table: HTMLTableElement) {
  const bodyRows = Array.from(table.tBodies[0]?.rows ?? []);
  if (!bodyRows.length) return;
  Array.from(table.tHead?.rows[0]?.cells ?? []).forEach((cell, index) => {
    const header = cell as HTMLTableCellElement;
    header.dataset.sortable = "true";
    header.tabIndex = 0;
    header.classList.add("sortable-column");
    if (!header.getAttribute("aria-sort")) header.setAttribute("aria-sort", "none");
    const values = bodyRows.map(row => row.cells[index]?.textContent?.trim() ?? "");
    if (values.filter(value => numericTableValue(value) !== null).length / values.length >= .65) {
      header.classList.add("numeric-column");
      bodyRows.forEach(row => row.cells[index]?.classList.add("numeric-column"));
    }
  });
}

function sortTableByHeader(header: HTMLTableCellElement) {
  const table = header.closest<HTMLTableElement>(tableSelector);
  const body = table?.tBodies[0];
  if (!table || !body) return;
  const index = header.cellIndex;
  const previousIndex = Number(table.dataset.sortIndex);
  const direction: SortDirection = previousIndex === index && table.dataset.sortDirection === "asc" ? "desc" : "asc";
  const rows = Array.from(body.rows).map((row, order) => ({ row, order, value: row.cells[index]?.textContent?.trim() ?? "" }));
  rows.sort((left, right) => compareTableValues(left.value, right.value, direction) || left.order - right.order);
  rows.forEach(({ row }) => body.appendChild(row));
  table.dataset.sortIndex = String(index);
  table.dataset.sortDirection = direction;
  Array.from(table.tHead?.rows[0]?.cells ?? []).forEach(cell => {
    const current = cell as HTMLTableCellElement;
    const active = current === header;
    current.classList.toggle("sort-active", active);
    current.dataset.sortDirection = active ? direction : "";
    current.setAttribute("aria-sort", active ? (direction === "asc" ? "ascending" : "descending") : "none");
  });
}

function canStartTableDrag(target: EventTarget | null) {
  return !(target instanceof Element && target.closest("button, a, input, select, textarea, label, th[data-sortable='true'], [contenteditable='true']"));
}

function bindMouseDragScroll(wrap: HTMLElement) {
  if (wrap.dataset.mouseDragScrollBound === "true") return () => {};
  wrap.dataset.mouseDragScrollBound = "true";
  let pointerId: number | null = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragging = false;
  let clearClickTimer: number | undefined;
  const finish = () => {
    if (pointerId !== null && wrap.hasPointerCapture(pointerId)) wrap.releasePointerCapture(pointerId);
    pointerId = null;
    wrap.classList.remove("table-mouse-dragging");
    if (dragging) {
      wrap.dataset.mouseDragScrollMoved = "true";
      clearClickTimer = window.setTimeout(() => delete wrap.dataset.mouseDragScrollMoved, 0);
    }
    dragging = false;
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || wrap.scrollWidth <= wrap.clientWidth || !canStartTableDrag(event.target)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = wrap.scrollLeft;
    dragging = false;
    wrap.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const delta = event.clientX - startX;
    if (!dragging && Math.abs(delta) < 4) return;
    if (!dragging) window.getSelection()?.removeAllRanges();
    dragging = true;
    wrap.classList.add("table-mouse-dragging");
    wrap.scrollLeft = startScrollLeft - delta;
    event.preventDefault();
  };
  const onClickCapture = (event: MouseEvent) => {
    if (wrap.dataset.mouseDragScrollMoved !== "true") return;
    event.preventDefault();
    event.stopPropagation();
  };
  wrap.addEventListener("pointerdown", onPointerDown);
  wrap.addEventListener("pointermove", onPointerMove);
  wrap.addEventListener("pointerup", finish);
  wrap.addEventListener("pointercancel", finish);
  wrap.addEventListener("lostpointercapture", finish);
  wrap.addEventListener("click", onClickCapture, true);
  return () => {
    if (clearClickTimer) window.clearTimeout(clearClickTimer);
    wrap.removeEventListener("pointerdown", onPointerDown);
    wrap.removeEventListener("pointermove", onPointerMove);
    wrap.removeEventListener("pointerup", finish);
    wrap.removeEventListener("pointercancel", finish);
    wrap.removeEventListener("lostpointercapture", finish);
    wrap.removeEventListener("click", onClickCapture, true);
    delete wrap.dataset.mouseDragScrollBound;
  };
}

/** Делает все аналитические таблицы кликабельно сортируемыми без изменения расчетных данных. */
export function SortableTablesBootstrap() {
  useEffect(() => {
    const dragCleanups = new Map<HTMLElement, () => void>();
    const hydrate = () => {
      document.querySelectorAll<HTMLTableElement>(tableSelector).forEach(hydrateTable);
      document.querySelectorAll<HTMLElement>(".data-table-wrap").forEach(wrap => {
        if (!dragCleanups.has(wrap)) dragCleanups.set(wrap, bindMouseDragScroll(wrap));
      });
      dragCleanups.forEach((cleanup, wrap) => {
        if (!document.body.contains(wrap)) { cleanup(); dragCleanups.delete(wrap); }
      });
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const header = target?.closest<HTMLTableCellElement>("table.data-table th[data-sortable='true']");
      if (!header || target?.closest("button, a, input, select, textarea")) return;
      sortTableByHeader(header);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const header = (event.target as Element | null)?.closest<HTMLTableCellElement>("table.data-table th[data-sortable='true']");
      if (!header) return;
      event.preventDefault();
      sortTableByHeader(header);
    };
    const observer = new MutationObserver(hydrate);
    hydrate();
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => { observer.disconnect(); document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKeyDown); dragCleanups.forEach(cleanup => cleanup()); };
  }, []);
  return null;
}
