import { ChevronUp, Eye, EyeOff, Pencil, Plus, Save, Tags, Warehouse, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuditShell } from "@/components/AuditShell";
import { ThemedSelect } from "@/components/ui/themed-select";
import { trpc } from "@/lib/trpc";
import "@/warehouse-control.css";
import "@/print-settings.css";

type PrintGroup = { id: number; name: string; isActive: boolean };
type CatalogCategory = { id: number; name: string; isActive: boolean };
type PrintCategoryGroup = {
  id: number;
  name: string;
  isActive: boolean;
  printMode: "per_store" | "grouped_stores";
  supplyPrintGroupId: number | null;
  requestCommentSlot: "slot_1" | "slot_2" | null;
  maxStoreCoverDays: number;
  members: Array<{
    id: number;
    memberType: "catalog_category" | "category_group";
    catalogCategoryId: number | null;
    catalogCategory: string | null;
    childGroupId: number | null;
    childGroupName: string | null;
  }>;
};
type WarehouseRow = { storeId: number; storeName: string; isHidden: boolean; printGroupId: number | null; printGroupName: string | null };
type CategoryEditor = Pick<PrintCategoryGroup, "id" | "name" | "printMode" | "supplyPrintGroupId" | "requestCommentSlot" | "maxStoreCoverDays">;
type RequestPrintSettings = {
  zebraMode: "none" | "rows" | "columns";
  headingFontSize: number;
  bodyFontSize: number;
  totalFontSize: number;
  headingBold: boolean;
  bodyBold: boolean;
  totalBold: boolean;
  showStoreQuantity: boolean;
  showAverageDailySales: boolean;
  showSalesCover: boolean;
  showOverstockSignal: boolean;
  recommendationFontSize: number;
  recommendationTone: "muted" | "dark";
};
type RevenuePrintSettings = Pick<RequestPrintSettings, "zebraMode" | "headingFontSize" | "bodyFontSize" | "totalFontSize" | "headingBold" | "bodyBold" | "totalBold">;
const defaultRequestPrintSettings: RequestPrintSettings = { zebraMode: "none", headingFontSize: 10, bodyFontSize: 9, totalFontSize: 9, headingBold: true, bodyBold: false, totalBold: true, showStoreQuantity: true, showAverageDailySales: true, showSalesCover: true, showOverstockSignal: true, recommendationFontSize: 7, recommendationTone: "muted" };
const defaultRevenuePrintSettings: RevenuePrintSettings = { zebraMode: "none", headingFontSize: 10, bodyFontSize: 9, totalFontSize: 9, headingBold: true, bodyBold: false, totalBold: true };
const requestTypographyControls = [
  { key: "heading", label: "Заголовки", sizeKey: "headingFontSize", boldKey: "headingBold" },
  { key: "body", label: "Строки", sizeKey: "bodyFontSize", boldKey: "bodyBold" },
  { key: "total", label: "Итоги", sizeKey: "totalFontSize", boldKey: "totalBold" },
] as const;

export default function PrintSettings() {
  const utils = trpc.useUtils();
  const me = trpc.localAuth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.role === "admin";
  const warehouses = trpc.inventoryRegistry.warehouses.useQuery(undefined, { enabled: isAdmin, retry: false });
  const printGroups = trpc.inventoryRegistry.printGroups.useQuery(undefined, { enabled: isAdmin, retry: false });
  const catalogCategories = trpc.inventoryRegistry.catalogCategories.useQuery(undefined, { enabled: isAdmin, retry: false });
  const printCategoryGroups = trpc.inventoryRegistry.printCategoryGroups.useQuery(undefined, { enabled: isAdmin, retry: false });
  const requestPrintSettings = trpc.inventoryRegistry.requestPrintSettings.useQuery(undefined, { enabled: isAdmin, retry: false });
  const revenuePrintSettings = trpc.revenueRegistry.printSettings.useQuery(undefined, { enabled: isAdmin, retry: false });
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string>>({});
  const [newPrintGroupName, setNewPrintGroupName] = useState("");
  const [editingPrintGroup, setEditingPrintGroup] = useState<PrintGroup | null>(null);
  const [newCategoryGroupName, setNewCategoryGroupName] = useState("");
  const [categoryMemberDrafts, setCategoryMemberDrafts] = useState<Record<number, string>>({});
  const [childGroupDrafts, setChildGroupDrafts] = useState<Record<number, string>>({});
  const [editingCategoryGroup, setEditingCategoryGroup] = useState<CategoryEditor | null>(null);
  // Only cards occupying one visual row share their disclosure action. Nested
  // print membership is unrelated to this visual convenience.
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Record<number, boolean>>({});
  const [categoryCardsStacked, setCategoryCardsStacked] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1040px)").matches);

  const activeGroups = ((printGroups.data ?? []) as PrintGroup[]).filter(group => group.isActive);
  const inactiveGroups = ((printGroups.data ?? []) as PrintGroup[]).filter(group => !group.isActive);
  const activeCategories = ((catalogCategories.data ?? []) as CatalogCategory[]).filter(category => category.isActive);
  const categoryGroups = (printCategoryGroups.data ?? []) as PrintCategoryGroup[];
  const requestSettings: RequestPrintSettings = { ...defaultRequestPrintSettings, ...((requestPrintSettings.data ?? {}) as Partial<RequestPrintSettings>) };
  const revenueSettings = { ...defaultRevenuePrintSettings, ...(revenuePrintSettings.data as Partial<RevenuePrintSettings> | undefined) };
  const visibleWarehouses = useMemo(() => ((warehouses.data ?? []) as WarehouseRow[]).filter(row => !row.isHidden), [warehouses.data]);
  useEffect(() => {
    setGroupDrafts(current => {
      const next = { ...current };
      for (const warehouse of visibleWarehouses) {
        if (next[warehouse.storeId] === undefined) next[warehouse.storeId] = warehouse.printGroupId ? String(warehouse.printGroupId) : "";
      }
      return next;
    });
  }, [visibleWarehouses]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1040px)");
    const update = () => setCategoryCardsStacked(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const invalidatePrintSettings = () => Promise.all([
    utils.inventoryRegistry.warehouses.invalidate(),
    utils.inventoryRegistry.printGroups.invalidate(),
    utils.inventoryRegistry.printCategoryGroups.invalidate(),
    utils.inventoryRegistry.catalogCategories.invalidate(),
    utils.inventoryRegistry.catalogCategoryNames.invalidate(),
    utils.inventoryRegistry.requestPrintSettings.invalidate(),
    utils.revenueRegistry.printSettings.invalidate(),
    utils.audit.changes.invalidate(),
  ]);
  const setWarehouseGroup = trpc.inventoryRegistry.setWarehousePrintGroup.useMutation({
    onSuccess: async () => {
      await invalidatePrintSettings();
      toast.success("Группа назначена магазину");
    },
    onError: error => toast.error("Группа не назначена", { description: error.message }),
  });
  const createGroup = trpc.inventoryRegistry.createPrintGroup.useMutation({
    onSuccess: async () => {
      setNewPrintGroupName("");
      await invalidatePrintSettings();
      toast.success("Группа печати создана");
    },
    onError: error => toast.error("Группа печати не создана", { description: error.message }),
  });
  const updateGroup = trpc.inventoryRegistry.updatePrintGroup.useMutation({
    onSuccess: async () => {
      setEditingPrintGroup(null);
      await invalidatePrintSettings();
      toast.success("Группа печати сохранена");
    },
    onError: error => toast.error("Группа печати не сохранена", { description: error.message }),
  });
  const deleteGroup = trpc.inventoryRegistry.deletePrintGroup.useMutation({
    onSuccess: async () => {
      setEditingPrintGroup(null);
      await invalidatePrintSettings();
      toast.success("Группа печати удалена");
    },
    onError: error => toast.error("Группа печати не удалена", { description: error.message }),
  });
  const createCategoryGroup = trpc.inventoryRegistry.createPrintCategoryGroup.useMutation({
    onSuccess: async () => {
      setNewCategoryGroupName("");
      await invalidatePrintSettings();
      toast.success("Категория печати создана");
    },
    onError: error => toast.error("Категория печати не создана", { description: error.message }),
  });
  const updateCategoryGroup = trpc.inventoryRegistry.updatePrintCategoryGroup.useMutation({
    onSuccess: async () => {
      setEditingCategoryGroup(null);
      await invalidatePrintSettings();
      toast.success("Категория печати сохранена");
    },
    onError: error => toast.error("Категория печати не сохранена", { description: error.message }),
  });
  const deleteCategoryGroup = trpc.inventoryRegistry.deletePrintCategoryGroup.useMutation({
    onSuccess: async () => {
      setEditingCategoryGroup(null);
      await invalidatePrintSettings();
      toast.success("Категория печати удалена");
    },
    onError: error => toast.error("Категория печати не удалена", { description: error.message }),
  });
  const addMember = trpc.inventoryRegistry.addPrintCategoryGroupMember.useMutation({
    onSuccess: invalidatePrintSettings,
    onError: error => toast.error("Состав категории не изменен", { description: error.message }),
  });
  const removeMember = trpc.inventoryRegistry.removePrintCategoryGroupMember.useMutation({
    onSuccess: invalidatePrintSettings,
    onError: error => toast.error("Состав категории не изменен", { description: error.message }),
  });
  const updateRequestPrintSettings = trpc.inventoryRegistry.updateRequestPrintSettings.useMutation({
    onSuccess: invalidatePrintSettings,
    onError: error => toast.error("Настройка печати не изменена", { description: error.message }),
  });
  const saveRequestPrintSettings = (patch: Partial<RequestPrintSettings>) => updateRequestPrintSettings.mutate({ ...requestSettings, ...patch });
  const saveRequestPrintSize = (part: "heading" | "body" | "total", value: number) => saveRequestPrintSettings(part === "heading" ? { headingFontSize: value } : part === "body" ? { bodyFontSize: value } : { totalFontSize: value });
  const toggleRequestPrintBold = (part: "heading" | "body" | "total") => saveRequestPrintSettings(part === "heading" ? { headingBold: !requestSettings.headingBold } : part === "body" ? { bodyBold: !requestSettings.bodyBold } : { totalBold: !requestSettings.totalBold });
  const setRequestCommentCategory = trpc.inventoryRegistry.setRequestCommentCategory.useMutation({
    onSuccess: async () => {
      await invalidatePrintSettings();
      toast.success("Комментарий печати настроен");
    },
    onError: error => toast.error("Комментарий печати не настроен", { description: error.message }),
  });
  const updateRevenuePrintSettings = trpc.revenueRegistry.updatePrintSettings.useMutation({
    onSuccess: async () => {
      await invalidatePrintSettings();
      toast.success("Вид печати выручки сохранен");
    },
    onError: error => toast.error("Настройка печати выручки не изменена", { description: error.message }),
  });
  const saveRevenuePrintSettings = (patch: Partial<RevenuePrintSettings>) => updateRevenuePrintSettings.mutate({ ...revenueSettings, ...patch });
  const saveRevenuePrintSize = (part: "heading" | "body" | "total", value: number) => saveRevenuePrintSettings(part === "heading" ? { headingFontSize: value } : part === "body" ? { bodyFontSize: value } : { totalFontSize: value });
  const toggleRevenuePrintBold = (part: "heading" | "body" | "total") => saveRevenuePrintSettings(part === "heading" ? { headingBold: !revenueSettings.headingBold } : part === "body" ? { bodyBold: !revenueSettings.bodyBold } : { totalBold: !revenueSettings.totalBold });

  if (!me.isLoading && !isAdmin) {
    return <AuditShell kicker="31 / НАСТРОЙКИ ПЕЧАТИ" title="Настройки печати"><section className="empty-state"><Tags size={28}/><h2>Настройки печати доступны администратору</h2><p>Заявки и печать остаются в операционных разделах согласно назначенной роли.</p></section></AuditShell>;
  }

  return <AuditShell kicker="31 / НАСТРОЙКИ ПЕЧАТИ" title="Настройки печати">
    <section className="page-lede print-settings-lede"><div><span>УПРАВЛЕНИЕ МАГАЗИНАМИ</span><h2>Группы и категории для заявок</h2><p>Здесь настраиваются магазины в листе, категории товаров, режим печати и два независимых комментария. Сами заявки всегда печатают все активные настройки.</p></div></section>

    <section className="packet-card print-settings-card">
      <div className="card-title"><div><span>ГРУППЫ МАГАЗИНОВ ДЛЯ ПЕЧАТИ</span><h3>Состав листов</h3><small>Назначение сохраняется сразу после выбора. Скрытые магазины не участвуют.</small></div></div>
      <form className="warehouse-print-group-create" onSubmit={event => { event.preventDefault(); createGroup.mutate({ name: newPrintGroupName }); }}><label>Новая группа печати<input value={newPrintGroupName} onChange={event => setNewPrintGroupName(event.target.value)} placeholder="Например, Область 1" maxLength={128}/></label><button className="subtle-button" disabled={createGroup.isPending || !newPrintGroupName.trim()}><Plus size={14}/>Создать</button></form>
      {editingPrintGroup ? <div className="warehouse-print-group-editor"><label>Группа печати<input value={editingPrintGroup.name} onChange={event => setEditingPrintGroup({ ...editingPrintGroup, name: event.target.value })} maxLength={128}/></label><button type="button" className="subtle-button" disabled={updateGroup.isPending || !editingPrintGroup.name.trim()} onClick={() => updateGroup.mutate(editingPrintGroup)}><Save size={14}/>Сохранить</button>{editingPrintGroup.isActive ? <button type="button" className="subtle-button" disabled={updateGroup.isPending} onClick={() => updateGroup.mutate({ ...editingPrintGroup, isActive: false })}><EyeOff size={14}/>Скрыть</button> : <button type="button" className="subtle-button" disabled={updateGroup.isPending} onClick={() => updateGroup.mutate({ ...editingPrintGroup, isActive: true })}><Eye size={14}/>Показать</button>}<button type="button" className="subtle-button subtle-danger" disabled={deleteGroup.isPending} onClick={() => { if (window.confirm(`Удалить группу печати «${editingPrintGroup.name}»? Магазины будут отсоединены только от этой группы; товары, цены, документы и история не изменятся.`)) deleteGroup.mutate({ id: editingPrintGroup.id }); }}><X size={14}/>Удалить</button><button type="button" className="subtle-button" onClick={() => setEditingPrintGroup(null)}><X size={14}/>Отмена</button></div> : <><div className="warehouse-print-group-list" aria-label="Активные группы печати">{activeGroups.length ? activeGroups.map(group => <button type="button" key={group.id} className="warehouse-print-group-chip" onClick={() => setEditingPrintGroup(group)}><Pencil size={13}/>{group.name}</button>) : <small>Активные группы печати еще не созданы.</small>}</div>{inactiveGroups.length > 0 && <div className="warehouse-print-group-recovery" aria-label="Скрытые группы печати"><span>СКРЫТЫЕ ГРУППЫ</span><small>Не участвуют в назначении и печати. Откройте группу, чтобы показать её снова.</small><div>{inactiveGroups.map(group => <button type="button" key={group.id} className="warehouse-print-group-chip is-inactive" onClick={() => setEditingPrintGroup(group)}><Pencil size={13}/>{group.name}</button>)}</div></div>}</>}
      <div className="print-settings-store-list">{visibleWarehouses.map(warehouse => <label key={warehouse.storeId}><strong>{warehouse.storeName}</strong><ThemedSelect searchable searchPlaceholder="Найти группу печати" value={groupDrafts[warehouse.storeId] ?? ""} onChange={event => { const value = event.target.value; setGroupDrafts(current => ({ ...current, [warehouse.storeId]: value })); if (value !== (warehouse.printGroupId ? String(warehouse.printGroupId) : "")) setWarehouseGroup.mutate({ storeId: warehouse.storeId, printGroupId: value ? Number(value) : null }); }}><option value="">Не назначена</option>{activeGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</ThemedSelect></label>)}</div>
    </section>

    <section className="packet-card print-settings-card">
      <div className="card-title"><div><span>КАТЕГОРИИ ДЛЯ ПЕЧАТИ ЗАЯВОК</span><h3>Состав печатных подборок</h3><small>«Отдельный лист на магазин» — подпись режима; каждый магазин будет на отдельной странице.</small></div></div>
      <div className="print-settings-inline-paper">
        <div><span>ВИД ПЕЧАТИ ЗАЯВОК</span><strong>Белый A4 и читаемая таблица</strong><small>Поля листа всегда белые. При необходимости добавляется только нейтральная зебра внутри таблицы.</small></div>
        <div className="print-settings-controls">
          <label>Зебра таблицы<ThemedSelect value={requestSettings.zebraMode} disabled={updateRequestPrintSettings.isPending} onChange={event => saveRequestPrintSettings({ zebraMode: event.target.value as "none" | "rows" | "columns" })}><option value="none">Без заливки</option><option value="rows">Чередовать строки</option><option value="columns">Чередовать столбцы</option></ThemedSelect></label>
          <div className="request-print-typography" aria-label="Шрифты печати заявки">
            {requestTypographyControls.map(control => (
              <label key={control.key}>{control.label}<span><ThemedSelect value={String(requestSettings[control.sizeKey])} disabled={updateRequestPrintSettings.isPending} onChange={event => saveRequestPrintSize(control.key, Number(event.target.value))}>{[7, 8, 9, 10, 11, 12, 13, 14].map(size => <option value={size} key={size}>{size} pt</option>)}</ThemedSelect><button type="button" className={requestSettings[control.boldKey] ? "subtle-button is-active" : "subtle-button"} aria-pressed={requestSettings[control.boldKey]} disabled={updateRequestPrintSettings.isPending} onClick={() => toggleRequestPrintBold(control.key)}>Жирный</button></span></label>
            ))}
          </div>
          <fieldset className="request-print-recommendations"><legend>Данные под товаром</legend><div className="request-print-recommendation-style"><label>Размер<ThemedSelect value={String(requestSettings.recommendationFontSize)} disabled={updateRequestPrintSettings.isPending} onChange={event => saveRequestPrintSettings({ recommendationFontSize: Number(event.target.value) })}>{[6, 7, 8, 9, 10].map(size => <option value={size} key={size}>{size} pt</option>)}</ThemedSelect></label><label>Цвет<ThemedSelect value={requestSettings.recommendationTone} disabled={updateRequestPrintSettings.isPending} onChange={event => saveRequestPrintSettings({ recommendationTone: event.target.value as RequestPrintSettings["recommendationTone"] })}><option value="muted">Серый</option><option value="dark">Черный</option></ThemedSelect></label></div>{([
            ["showStoreQuantity", "Остаток магазина"],
            ["showAverageDailySales", "Средние продажи за день"],
            ["showSalesCover", "Покрытие запаса"],
            ["showOverstockSignal", "Сигнал избыточного заказа"],
          ] as const).map(([key, label]) => <label className="print-settings-switch" key={key}><input type="checkbox" checked={requestSettings[key]} disabled={updateRequestPrintSettings.isPending} onChange={event => saveRequestPrintSettings({ [key]: event.target.checked })}/><span className="print-settings-switch-track" aria-hidden="true"/><span>{label}</span></label>)}</fieldset>
        </div>
      </div>
      <div className="print-settings-inline-paper">
        <div>
          <span>ВИД ПЕЧАТИ ВЫРУЧКИ</span>
          <strong>Белый A4 и читаемая таблица</strong>
          <small>Поля листа всегда белые. При необходимости добавляется только нейтральная зебра внутри таблицы.</small>
        </div>
        <div className="print-settings-controls">
          <label>Зебра таблицы
            <ThemedSelect value={revenueSettings.zebraMode} disabled={updateRevenuePrintSettings.isPending} onChange={event => saveRevenuePrintSettings({ zebraMode: event.target.value as "none" | "rows" | "columns" })}>
              <option value="none">Без заливки</option>
              <option value="rows">Чередовать строки</option>
              <option value="columns">Чередовать столбцы</option>
            </ThemedSelect>
          </label>
          <div className="request-print-typography" aria-label="Шрифты печати выручки">
            {requestTypographyControls.map(control => (
              <label key={control.key}>
                {control.label}
                <span>
                  <ThemedSelect value={String(revenueSettings[control.sizeKey])} disabled={updateRevenuePrintSettings.isPending} onChange={event => saveRevenuePrintSize(control.key, Number(event.target.value))}>
                    {[7, 8, 9, 10, 11, 12, 13, 14].map(size => <option value={size} key={size}>{size} pt</option>)}
                  </ThemedSelect>
                  <button type="button" className={revenueSettings[control.boldKey] ? "subtle-button is-active" : "subtle-button"} aria-pressed={revenueSettings[control.boldKey]} disabled={updateRevenuePrintSettings.isPending} onClick={() => toggleRevenuePrintBold(control.key)}>Жирный</button>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="print-settings-comments" aria-label="Комментарии к печати заявок"><div><span>КОММЕНТАРИИ К ПЕЧАТИ ЗАЯВОК</span><strong>Настраиваются отдельно от состава категории</strong><small>Каждый комментарий появляется только в листе назначенной категории.</small></div>{(["slot_1", "slot_2"] as const).map(slot => { const assigned = categoryGroups.find(group => group.requestCommentSlot === slot); return <label key={slot}>{slot === "slot_1" ? "Комментарий к Мороженной продукции" : "Комментарий к Копченой продукции"}<ThemedSelect value={assigned ? String(assigned.id) : ""} disabled={setRequestCommentCategory.isPending} onChange={event => setRequestCommentCategory.mutate({ slot, categoryGroupId: event.target.value ? Number(event.target.value) : null })}><option value="">Не печатать</option>{categoryGroups.filter(group => group.isActive || group.id === assigned?.id).map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</ThemedSelect></label>; })}</div>
      <form className="warehouse-print-group-create" onSubmit={event => { event.preventDefault(); createCategoryGroup.mutate({ name: newCategoryGroupName, printMode: "per_store" }); }}><label>Новая категория печати<input value={newCategoryGroupName} onChange={event => setNewCategoryGroupName(event.target.value)} placeholder="Например, СРС" maxLength={128}/></label><button className="subtle-button" disabled={!newCategoryGroupName.trim() || createCategoryGroup.isPending}><Plus size={14}/>Создать</button></form>
      <div className="warehouse-category-print-groups">{categoryGroups.length ? categoryGroups.map((group, index) => { const isEditing = editingCategoryGroup?.id === group.id; const pairStart = Math.floor(index / 2) * 2; const visibleNeighborIds = categoryCardsStacked ? [group.id] : categoryGroups.slice(pairStart, pairStart + 2).map(candidate => candidate.id); const isExpanded = isEditing || visibleNeighborIds.some(id => expandedCategoryGroups[id]); const toggleMembers = () => setExpandedCategoryGroups(current => { const next = !isExpanded; return { ...current, ...Object.fromEntries(visibleNeighborIds.map(id => [id, next])) }; }); return <article key={group.id}>{isEditing ? <div className="warehouse-category-group-editor"><label>Название группы<input value={editingCategoryGroup.name} onChange={event => setEditingCategoryGroup(current => current ? { ...current, name: event.target.value } : current)} maxLength={128}/></label><label>Режим листа<ThemedSelect value={editingCategoryGroup.printMode} onChange={event => setEditingCategoryGroup(current => current ? { ...current, printMode: event.target.value as "per_store" | "grouped_stores" } : current)}><option value="per_store">Отдельный лист на магазин</option><option value="grouped_stores">Все магазины вместе</option></ThemedSelect></label><label>Макс. запас в магазине, дни<input type="number" min="1" max="14" step="1" value={editingCategoryGroup.maxStoreCoverDays} onChange={event => setEditingCategoryGroup(current => current ? { ...current, maxStoreCoverDays: Number(event.target.value) || 1 } : current)}/></label><div className="warehouse-category-group-actions"><button type="button" className="subtle-button" disabled={!editingCategoryGroup.name.trim() || updateCategoryGroup.isPending} onClick={() => updateCategoryGroup.mutate(editingCategoryGroup)}><Save size={14}/>Сохранить</button><button type="button" className="subtle-button subtle-danger" disabled={deleteCategoryGroup.isPending} onClick={() => { if (window.confirm(`Удалить категорию печати «${group.name}»? Товары не изменятся, а вложенные связи будут отсоединены.`)) deleteCategoryGroup.mutate({ id: group.id }); }}><X size={14}/>Удалить</button><button type="button" className="subtle-button" onClick={() => setEditingCategoryGroup(null)}><ChevronUp size={14}/>Отмена</button></div></div> : <div className="warehouse-category-group-heading"><div><strong>{group.name}</strong><span className="warehouse-category-print-mode">{group.printMode === "per_store" ? "Отдельный лист на магазин" : "Все магазины вместе"}{` · максимум ${group.maxStoreCoverDays} дн.`}</span></div><button type="button" className="subtle-button warehouse-category-group-edit" onClick={() => setEditingCategoryGroup({ id: group.id, name: group.name, printMode: group.printMode, supplyPrintGroupId: group.supplyPrintGroupId, requestCommentSlot: group.requestCommentSlot, maxStoreCoverDays: group.maxStoreCoverDays })}><Pencil size={14}/>Изменить</button></div>}{!isEditing && <button type="button" className={`subtle-button warehouse-category-members-toggle${isExpanded ? " is-expanded" : ""}`} aria-expanded={isExpanded} aria-controls={`print-category-members-${group.id}`} onClick={toggleMembers}><ChevronUp size={14}/>{isExpanded ? "Скрыть состав" : `Состав: ${group.members.length}`}</button>}{isExpanded && <div id={`print-category-members-${group.id}`} className="warehouse-category-members-panel"><div className="warehouse-category-member-list">{group.members.length ? group.members.map(member => <span className="warehouse-category-member" key={member.id}>{member.memberType === "catalog_category" ? member.catalogCategory : member.childGroupName}<button type="button" aria-label="Убрать из группы" onClick={() => removeMember.mutate({ groupId: group.id, memberId: member.id })}><X size={12}/></button></span>) : <small>Состав категории пока не задан.</small>}</div><div className="warehouse-category-add"><ThemedSelect searchable searchPlaceholder="Найти категорию" value={categoryMemberDrafts[group.id] ?? ""} onChange={event => setCategoryMemberDrafts(current => ({ ...current, [group.id]: event.target.value }))}><option value="">Категория товара</option>{activeCategories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</ThemedSelect><button type="button" className="subtle-button" disabled={!categoryMemberDrafts[group.id] || addMember.isPending} onClick={() => addMember.mutate({ groupId: group.id, memberType: "catalog_category", catalogCategoryId: Number(categoryMemberDrafts[group.id]) })}><Plus size={14}/>Добавить категорию</button><ThemedSelect searchable searchPlaceholder="Найти вложенную группу" value={childGroupDrafts[group.id] ?? ""} onChange={event => setChildGroupDrafts(current => ({ ...current, [group.id]: event.target.value }))}><option value="">Вложенная группа</option>{categoryGroups.filter(candidate => candidate.id !== group.id).map(candidate => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</ThemedSelect><button type="button" className="subtle-button" disabled={!childGroupDrafts[group.id] || addMember.isPending} onClick={() => addMember.mutate({ groupId: group.id, memberType: "category_group", childGroupId: Number(childGroupDrafts[group.id]) })}><Plus size={14}/>Добавить группу</button></div></div>}</article>; }) : <p className="packet-note">Создайте группу, затем добавьте в нее категории номенклатуры или другую печатную группу.</p>}</div>
    </section>

    <section className="warehouse-guidance"><article><Warehouse size={18}/><div><span>ПЕЧАТЬ ЗАЯВОК</span><strong>Все активные настройки участвуют автоматически</strong><p>В заявках не выбирают набор листов: после закрытия печатаются все активные группы магазинов и категории.</p></div></article><article><Tags size={18}/><div><span>КАТЕГОРИИ ТОВАРОВ</span><strong>Редактируются в «Номенклатуре»</strong><p>Здесь задается только состав печатного листа, а не создается товар и не меняется карточка номенклатуры.</p></div></article></section>
  </AuditShell>;
}
