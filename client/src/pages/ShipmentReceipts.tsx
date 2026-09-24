import { CheckCircle2, ClipboardCheck, PackageCheck, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { formatBusinessDate, normalizeDecimalInputText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import "@/shipment-receipts.css";

type Unit = "kg" | "l" | "piece";
type ReceiptStatus = "awaiting_store" | "reported" | "confirmed";
type ReceiptSummary = { id: number; businessDate: string; storeId: number; storeName: string; documentNumber: string | null; lineCount: number; receiptStatus: ReceiptStatus; differenceCount: number; reportedAt: Date | string | null; confirmedAt: Date | string | null };
type ReceiptDetail = ReceiptSummary & { receiptId: number | null; receiptNote: string | null; lines: Array<{ shipmentLineId: number; productId: number; productName: string; expectedQuantity: number; actualQuantity: number | null; unit: Unit; expirationDate: string | null }> };

const units: Record<Unit, string> = { kg: "кг", l: "л", piece: "шт" };
const dateText = (value: string) => formatBusinessDate(value);
const quantity = (value: number) => String(Math.round(value * 1_000) / 1_000);
const numericInput = (value: string) => {
  const normalized = normalizeDecimalInputText(value).replace(/[^0-9.]/g, "");
  const [whole, ...fraction] = normalized.split(".");
  return fraction.length ? `${whole}.${fraction.join("").slice(0, 3)}` : whole;
};
const statusLabel: Record<ReceiptStatus, string> = { awaiting_store: "Ожидает магазин", reported: "Есть расхождение", confirmed: "Подтверждено" };

export default function ShipmentReceipts() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const queue = trpc.inventoryRegistry.onecShipmentReceipts.useQuery({ limit: 80 }, { retry: false });
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  const detail = trpc.inventoryRegistry.onecShipmentReceiptDetail.useQuery({ shipmentId: shipmentId ?? 0 }, { enabled: shipmentId !== null, retry: false });
  const [actuals, setActuals] = useState<Record<number, string>>({});
  const [note, setNote] = useState("");
  const isManager = me.data?.role === "manager" || me.data?.role === "admin";
  const active = detail.data as ReceiptDetail | undefined;

  useEffect(() => {
    if (!active) return;
    setActuals(Object.fromEntries(active.lines.map(line => [line.shipmentLineId, quantity(line.actualQuantity ?? line.expectedQuantity)])));
    setNote(active.receiptNote ?? "");
  }, [active?.id, active?.receiptStatus]);

  const report = trpc.inventoryRegistry.reportOnecShipmentReceipt.useMutation({
    onSuccess: async result => {
      toast.success(result.status === "confirmed" ? "Приёмка подтверждена магазином" : "Расхождение передано на подтверждение");
      await Promise.all([utils.inventoryRegistry.onecShipmentReceipts.invalidate(), utils.inventoryRegistry.onecShipmentReceiptDetail.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const confirm = trpc.inventoryRegistry.confirmOnecShipmentReceipt.useMutation({
    onSuccess: async () => {
      toast.success("Расхождение подтверждено");
      await Promise.all([utils.inventoryRegistry.onecShipmentReceipts.invalidate(), utils.inventoryRegistry.onecShipmentReceiptDetail.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });

  const differences = useMemo(() => active?.lines.filter(line => Math.abs(line.expectedQuantity - Number(actuals[line.shipmentLineId] ?? "")) > 0.0005).length ?? 0, [active?.lines, actuals]);
  const submit = () => {
    if (!active) return;
    const lines = active.lines.map(line => ({ shipmentLineId: line.shipmentLineId, actualQuantity: Number(actuals[line.shipmentLineId]) }));
    if (lines.some(line => !Number.isFinite(line.actualQuantity) || line.actualQuantity < 0)) return toast.error("Укажите фактическое количество по каждой строке.");
    report.mutate({ shipmentId: active.id, storeNote: note.trim() || undefined, lines });
  };
  const open = (item: ReceiptSummary) => setShipmentId(item.id);
  const busy = report.isPending || confirm.isPending;

  return <AuditShell kicker="35 / ПРИЁМКА" title="Приёмка накладных">
    <section className="page-lede receipt-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Факт в магазине — до учётного решения</h2><p>Сверьте накладную с фактически принятым товаром. При полном совпадении магазин подтверждает её сам; расхождение отправляется руководителю или администратору. Технические ключи 1С и адреса не отображаются.</p></div></section>
    <section className="receipt-temporal-policy"><ShieldAlert size={18}/><div><strong>Подтверждённая приёмка сразу учитывается во временном остатке</strong><span>Факт поставки добавляется ровно один раз. Если позже придёт более свежий снимок Эвотор, он заменит прежнюю временную проекцию вместе с уже учтённой продажей — остаток не сложится дважды.</span></div></section>
    <section className="packet-split receipt-layout">
      <article className="packet-card receipt-queue"><div className="card-title"><div><span>ОЧЕРЕДЬ</span><h3>Накладные для приёмки</h3></div><small>{(queue.data as ReceiptSummary[] | undefined)?.length ?? 0}</small></div>{queue.isLoading ? <p className="packet-note">Загружаем накладные…</p> : !(queue.data as ReceiptSummary[] | undefined)?.length ? <div className="empty-state compact"><PackageCheck size={26}/><h2>Накладных для приёмки нет</h2><p>После сопоставления и поступления расходной накладной 1С она появится здесь.</p></div> : <div className="receipt-queue-list">{(queue.data as ReceiptSummary[]).map(item => <button type="button" key={item.id} className={shipmentId === item.id ? "receipt-queue-item is-selected" : "receipt-queue-item"} onClick={() => open(item)}><span className={`receipt-status is-${item.receiptStatus}`}>{statusLabel[item.receiptStatus]}</span><strong>{item.storeName}</strong><small>{dateText(item.businessDate)} · {item.lineCount} поз.{item.documentNumber ? ` · № ${item.documentNumber}` : ""}</small>{item.differenceCount > 0 && <em>Расхождений: {item.differenceCount}</em>}</button>)}</div>}</article>
      <article className="packet-card receipt-detail"><div className="card-title"><div><span>ФАКТИЧЕСКАЯ ПРИЁМКА</span><h3>{active ? active.storeName : "Выберите накладную"}</h3></div>{active && <span className={`receipt-status is-${active.receiptStatus}`}>{statusLabel[active.receiptStatus]}</span>}</div>{shipmentId === null ? <div className="empty-state compact"><ClipboardCheck size={26}/><h2>Выберите накладную</h2><p>Откройте документ слева, сравните поставку и передайте факт.</p></div> : detail.isLoading || !active ? <p className="packet-note">Открываем накладную…</p> : <><div className="receipt-meta"><span>Дата: <b>{dateText(active.businessDate)}</b></span>{active.documentNumber && <span>Номер: <b>{active.documentNumber}</b></span>}<span>{active.receiptStatus === "confirmed" ? "Факт закреплён и учтён во временном остатке" : differences ? `Расхождений сейчас: ${differences}` : "Факт совпадает с накладной"}</span></div><div className="data-table-wrap receipt-table-wrap"><table className="data-table receipt-table"><thead><tr><th>№</th><th>Товар</th><th>Накладная</th><th>Фактически принято</th><th>Срок</th></tr></thead><tbody>{active.lines.map((line, index) => <tr key={line.shipmentLineId}><td data-label="№">{index + 1}</td><td data-label="Товар"><strong>{line.productName}</strong></td><td data-label="Накладная">{quantity(line.expectedQuantity)} {units[line.unit]}</td><td data-label="Фактически принято">{active.receiptStatus === "confirmed" ? <strong>{quantity(line.actualQuantity ?? line.expectedQuantity)} {units[line.unit]}</strong> : <label className="receipt-actual-input"><input inputMode="decimal" value={actuals[line.shipmentLineId] ?? ""} onChange={event => setActuals(current => ({ ...current, [line.shipmentLineId]: numericInput(event.target.value) }))} aria-label={`Фактически принято: ${line.productName}`} /><span>{units[line.unit]}</span></label>}</td><td data-label="Срок">{line.expirationDate ?? "не передан"}</td></tr>)}</tbody></table></div>{active.receiptStatus !== "confirmed" && <label className="receipt-note"><span>Комментарий к приёмке</span><input value={note} maxLength={512} onChange={event => setNote(event.target.value)} placeholder="Например, недопоставка одной позиции" /></label>}<div className="receipt-actions">{active.receiptStatus !== "confirmed" && <button type="button" className="subtle-button" onClick={submit} disabled={busy}><CheckCircle2 size={15}/>{differences ? "Передать расхождение" : "Подтвердить приёмку"}</button>}{active.receiptStatus === "reported" && isManager && <ConfirmDangerDialog trigger={<button type="button" className="subtle-button receipt-confirm" disabled={busy}><ClipboardCheck size={15}/>Подтвердить расхождение</button>} title="Подтвердить фактическую приёмку?" description={`Будет закреплён и добавлен во временный остаток факт по ${active.lines.length} позициям. Поздний снимок Эвотор заменит этот временный расчёт без двойного учёта.`} confirmLabel="Подтвердить" onConfirm={() => confirm.mutate({ shipmentId: active.id })} disabled={busy}/>}</div></>}</article>
    </section>
  </AuditShell>;
}
