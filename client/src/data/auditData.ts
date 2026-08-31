/**
 * AuditLine design reminder: warm-paper editorial report, forest-green authority,
 * bordeaux for risk, jade for verified improvement. Source: audited user workbook.
 */
export type StoreProfile = {
  store: string;
  revenue: number;
  netProfit: number;
  netMargin: number;
  grossMargin: number;
  bestMonth: string;
  lossMonths: number;
  reserve: string;
  reserveAmount: number;
};

export const monthlyData = [
  { month: "Янв", revenue: 79.7, profit: 5.37, margin: 6.7 },
  { month: "Фев", revenue: 88.0, profit: 5.50, margin: 6.2 },
  { month: "Мар", revenue: 98.4, profit: 6.83, margin: 6.9 },
  { month: "Апр", revenue: 92.6, profit: 4.30, margin: 4.6 },
  { month: "Май", revenue: 78.1, profit: 1.07, margin: 1.4 },
  { month: "Июн", revenue: 76.0, profit: 2.52, margin: 3.3 },
  { month: "Июл", revenue: 77.2, profit: 1.21, margin: 1.6 },
  { month: "Авг", revenue: 58.0, profit: 7.64, margin: 13.2 },
];

export const costData = [
  { name: "Закупки", value: 481.8, color: "#145b44" },
  { name: "ФОТ", value: 58.4, color: "#aa4439" },
  { name: "Аренда", value: 20.6, color: "#b4985f" },
  { name: "Налог", value: 20.0, color: "#6f746c" },
  { name: "Эквайринг", value: 11.3, color: "#3d8b79" },
  { name: "Прочее", value: 36.3, color: "#d7cebb" },
];

export const stores: StoreProfile[] = [
  { store: "ПОРТ", revenue: 100.346, netProfit: 9.247, netMargin: 9.2, grossMargin: 22.1, bestMonth: "Август", lossMonths: 0, reserve: "Эквайринг", reserveAmount: 0.086 },
  { store: "КИР1", revenue: 45.774, netProfit: 4.896, netMargin: 10.7, grossMargin: 25.9, bestMonth: "Апрель", lossMonths: 0, reserve: "Нет значимого избытка", reserveAmount: 0 },
  { store: "А2", revenue: 42.736, netProfit: 4.649, netMargin: 10.9, grossMargin: 26.6, bestMonth: "Март", lossMonths: 0, reserve: "Налог с валовой прибыли", reserveAmount: 0.026 },
  { store: "ОЛЕ", revenue: 26.166, netProfit: 2.439, netMargin: 9.3, grossMargin: 26.5, bestMonth: "Февраль", lossMonths: 0, reserve: "Наличные траты", reserveAmount: 0.176 },
  { store: "А1", revenue: 27.563, netProfit: 2.245, netMargin: 8.1, grossMargin: 27.3, bestMonth: "Март", lossMonths: 0, reserve: "Наличные траты", reserveAmount: 0.099 },
  { store: "КОВ", revenue: 25.906, netProfit: 1.653, netMargin: 6.4, grossMargin: 27.9, bestMonth: "Март", lossMonths: 1, reserve: "Аренда", reserveAmount: 0.466 },
  { store: "ПОЛ", revenue: 15.783, netProfit: 1.477, netMargin: 9.4, grossMargin: 27.1, bestMonth: "Март", lossMonths: 1, reserve: "Списания", reserveAmount: 0.195 },
  { store: "КИР3", revenue: 17.029, netProfit: 1.475, netMargin: 8.7, grossMargin: 26.1, bestMonth: "Апрель", lossMonths: 1, reserve: "Эквайринг", reserveAmount: 0.006 },
  { store: "ЗАП", revenue: 21.335, netProfit: 1.399, netMargin: 6.6, grossMargin: 26.1, bestMonth: "Август", lossMonths: 1, reserve: "Списания", reserveAmount: 0.064 },
  { store: "КА2", revenue: 13.746, netProfit: 1.398, netMargin: 10.2, grossMargin: 29.3, bestMonth: "Март", lossMonths: 0, reserve: "Налог с валовой прибыли", reserveAmount: 0.052 },
  { store: "КНИП", revenue: 29.469, netProfit: 1.249, netMargin: 4.2, grossMargin: 24.3, bestMonth: "Август", lossMonths: 2, reserve: "Списания", reserveAmount: 0.326 },
  { store: "С1", revenue: 23.955, netProfit: 1.034, netMargin: 4.3, grossMargin: 25.1, bestMonth: "Июнь", lossMonths: 0, reserve: "Списания", reserveAmount: 0.234 },
  { store: "ГС2", revenue: 16.366, netProfit: 0.983, netMargin: 6.0, grossMargin: 25.7, bestMonth: "Март", lossMonths: 1, reserve: "Коммунальные", reserveAmount: 0.114 },
  { store: "К49", revenue: 16.856, netProfit: 0.772, netMargin: 4.6, grossMargin: 26.0, bestMonth: "Январь", lossMonths: 2, reserve: "Аренда", reserveAmount: 0.220 },
  { store: "А3", revenue: 13.270, netProfit: 0.661, netMargin: 5.0, grossMargin: 26.5, bestMonth: "Июнь", lossMonths: 1, reserve: "Аренда", reserveAmount: 0.390 },
  { store: "Л76", revenue: 12.600, netProfit: 0.639, netMargin: 5.1, grossMargin: 24.3, bestMonth: "Август", lossMonths: 2, reserve: "Списания", reserveAmount: 0.145 },
  { store: "СНЕЖ", revenue: 11.555, netProfit: 0.548, netMargin: 4.7, grossMargin: 26.1, bestMonth: "Январь", lossMonths: 1, reserve: "Аренда", reserveAmount: 0.000 },
  { store: "ГС1", revenue: 17.045, netProfit: 0.467, netMargin: 2.7, grossMargin: 26.1, bestMonth: "Август", lossMonths: 1, reserve: "ФОТ", reserveAmount: 0.000 },
  { store: "К80", revenue: 11.282, netProfit: 0.410, netMargin: 3.6, grossMargin: 26.0, bestMonth: "Август", lossMonths: 2, reserve: "Аренда", reserveAmount: 0.064 },
  { store: "МОН", revenue: 15.840, netProfit: 0.302, netMargin: 1.9, grossMargin: 25.8, bestMonth: "Август", lossMonths: 4, reserve: "ФОТ", reserveAmount: 0.279 },
  { store: "ПЗ2", revenue: 12.063, netProfit: 0.225, netMargin: 1.9, grossMargin: 25.6, bestMonth: "Август", lossMonths: 4, reserve: "ФОТ", reserveAmount: 0.262 },
  { store: "ЗАО", revenue: 10.264, netProfit: 0.116, netMargin: 1.1, grossMargin: 26.5, bestMonth: "Март", lossMonths: 3, reserve: "ФОТ", reserveAmount: 0.120 },
  { store: "КИР2", revenue: 11.168, netProfit: 0.038, netMargin: 0.3, grossMargin: 26.9, bestMonth: "Март", lossMonths: 3, reserve: "ФОТ", reserveAmount: 0.145 },
  { store: "РОС", revenue: 10.088, netProfit: 0.011, netMargin: 0.1, grossMargin: 26.7, bestMonth: "Август", lossMonths: 4, reserve: "ФОТ", reserveAmount: 0.202 },
  { store: "ПЗ1", revenue: 10.429, netProfit: -0.051, netMargin: -0.5, grossMargin: 25.1, bestMonth: "Август", lossMonths: 6, reserve: "Аренда", reserveAmount: 0.303 },
  { store: "С2", revenue: 10.991, netProfit: -0.073, netMargin: -0.7, grossMargin: 27.2, bestMonth: "Февраль", lossMonths: 2, reserve: "Аренда", reserveAmount: 1.219 },
  { store: "МИРА", revenue: 8.434, netProfit: -0.116, netMargin: -1.4, grossMargin: 27.1, bestMonth: "Август", lossMonths: 4, reserve: "ФОТ", reserveAmount: 0.416 },
  { store: "П.ЗОР", revenue: 15.749, netProfit: -0.128, netMargin: -0.8, grossMargin: 27.8, bestMonth: "Февраль", lossMonths: 3, reserve: "Наличные траты", reserveAmount: 0.490 },
  { store: "МАК", revenue: 7.645, netProfit: -0.278, netMargin: -3.6, grossMargin: 26.9, bestMonth: "Август", lossMonths: 5, reserve: "ФОТ", reserveAmount: 0.410 },
  { store: "УМБА", revenue: 7.902, netProfit: -0.411, netMargin: -5.2, grossMargin: 26.4, bestMonth: "Август", lossMonths: 6, reserve: "ФОТ", reserveAmount: 0.502 },
  { store: "МОЛ", revenue: 1.369, netProfit: -0.419, netMargin: -30.6, grossMargin: 19.7, bestMonth: "Апрель", lossMonths: 3, reserve: "ФОТ", reserveAmount: 0.207 },
  { store: "С3", revenue: 7.940, netProfit: -0.447, netMargin: -5.6, grossMargin: 25.5, bestMonth: "Август", lossMonths: 6, reserve: "ФОТ", reserveAmount: 0.526 },
  { store: "КА1", revenue: 6.865, netProfit: -0.475, netMargin: -6.9, grossMargin: 28.6, bestMonth: "Январь", lossMonths: 3, reserve: "ФОТ", reserveAmount: 0.715 },
  { store: "НИК", revenue: 9.539, netProfit: -0.658, netMargin: -6.9, grossMargin: 25.6, bestMonth: "Август", lossMonths: 7, reserve: "ФОТ", reserveAmount: 0.434 },
  { store: "Н95", revenue: 13.059, netProfit: -0.845, netMargin: -6.5, grossMargin: 27.0, bestMonth: "Август", lossMonths: 7, reserve: "ФОТ", reserveAmount: 1.091 },
];

export const actionPlan = [
  { point: "МОЛ", owner: "Операции · развитие", period: "45 дней", target: "+419 тыс. руб.", action: "Экспресс-проверка локации; закрытие или релокация при недостижении эффекта." },
  { point: "Н95", owner: "Операции · HR", period: "20 дней", target: "−1 091 тыс. ФОТ", action: "Переразвернуть смены и пересмотреть роли; контролировать ФОТ еженедельно." },
  { point: "КА1", owner: "Операции · HR", period: "30 дней", target: "−715 тыс. ФОТ", action: "Нормировать ФОТ и подтвердить жизнеспособность формата точки." },
  { point: "С2", owner: "Развитие · коммерция", period: "45 дней", target: "−1 219 тыс. аренды", action: "Переговоры по аренде; при отказе — сценарий релокации." },
  { point: "П.ЗОР", owner: "Финансы · розница", period: "10 дней", target: "−490 тыс. трат", action: "Сверить наличные траты с первичкой и установить месячные лимиты." },
];

export const auditChecks = [
  ["Листов-магазинов", "43"], ["Проверено месячных P&L-блоков", "516"],
  ["Сверено формульных ячеек", "310 723"], ["Ошибки и расхождения > 0,15 руб.", "0"],
] as const;
