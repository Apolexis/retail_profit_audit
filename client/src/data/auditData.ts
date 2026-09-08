/** AuditLine: corrected Jan–Aug 2026 base; warm-paper investment-committee report. */

export type StoreProfile = { store:string; revenue:number; netProfit:number; netMargin:number; grossMargin:number; bestMonth:string; worstMonth:string; lossMonths:number; reserve:string; reserveAmount:number; inventoryEffect:number; narrative:string; };

export const monthlyData = [
  {
    "month": "Янв",
    "revenue": 78.0,
    "profit": 5.47,
    "margin": 7.0
  },
  {
    "month": "Фев",
    "revenue": 86.2,
    "profit": 5.63,
    "margin": 6.5
  },
  {
    "month": "Мар",
    "revenue": 96.5,
    "profit": 6.93,
    "margin": 7.2
  },
  {
    "month": "Апр",
    "revenue": 91.4,
    "profit": 4.31,
    "margin": 4.7
  },
  {
    "month": "Май",
    "revenue": 77.1,
    "profit": 1.18,
    "margin": 1.5
  },
  {
    "month": "Июн",
    "revenue": 75.5,
    "profit": 2.58,
    "margin": 3.4
  },
  {
    "month": "Июл",
    "revenue": 77.2,
    "profit": 0.87,
    "margin": 1.1
  },
  {
    "month": "Авг",
    "revenue": 84.2,
    "profit": 4.77,
    "margin": 5.7
  }
];

export const costData = [
  {
    "name": "Закупочная себестоимость",
    "value": 495.4,
    "color": "#1e4d3b"
  },
  {
    "name": "ФОТ и налоги",
    "value": 60.7,
    "color": "#3f7663"
  },
  {
    "name": "Аренда",
    "value": 23.8,
    "color": "#7fa89b"
  },
  {
    "name": "Налог с валовой прибыли",
    "value": 20.5,
    "color": "#b8995c"
  },
  {
    "name": "Банковская комиссия",
    "value": 11.3,
    "color": "#a5594e"
  },
  {
    "name": "Коммунальные платежи",
    "value": 7.4,
    "color": "#7b7b72"
  },
  {
    "name": "Списания",
    "value": 7.1,
    "color": "#c7bead"
  },
  {
    "name": "Наличные операционные траты",
    "value": 7.0,
    "color": "#d8d2c5"
  }
];

export const inventoryData = [
  {
    "name": "Перемещения: поступления",
    "value": 1.03
  },
  {
    "name": "Перемещения: выбытия",
    "value": -1.23
  },
  {
    "name": "Уценка (уменьшение остатка)",
    "value": -0.89
  },
  {
    "name": "Переоценка (увеличение остатка)",
    "value": 0.91
  },
  {
    "name": "Чистый эффект на остаток",
    "value": -0.19
  }
];

export const stores: StoreProfile[] = [
  {
    "store": "ПОРТ",
    "revenue": 105.191,
    "netProfit": 9.258,
    "netMargin": 8.8,
    "grossMargin": 22.1,
    "bestMonth": "Август",
    "worstMonth": "Январь",
    "lossMonths": 0,
    "reserve": "Банковская комиссия",
    "reserveAmount": 0.07,
    "inventoryEffect": -0.075,
    "narrative": "Маржа 8.8% не ниже сети (4.8%); валовая маржа 22.1% поддерживает положительный результат."
  },
  {
    "store": "А2",
    "revenue": 44.81,
    "netProfit": 4.586,
    "netMargin": 10.2,
    "grossMargin": 26.6,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 0,
    "reserve": "Налог с валовой прибыли",
    "reserveAmount": 0.027,
    "inventoryEffect": 0.018,
    "narrative": "Маржа 10.2% не ниже сети (4.8%); валовая маржа 26.6% поддерживает положительный результат."
  },
  {
    "store": "КИР1",
    "revenue": 47.934,
    "netProfit": 4.339,
    "netMargin": 9.1,
    "grossMargin": 25.9,
    "bestMonth": "Апрель",
    "worstMonth": "Июнь",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.0,
    "inventoryEffect": 0.099,
    "narrative": "Маржа 9.1% не ниже сети (4.8%); валовая маржа 25.9% поддерживает положительный результат."
  },
  {
    "store": "ОЛЕ",
    "revenue": 27.156,
    "netProfit": 2.429,
    "netMargin": 8.9,
    "grossMargin": 26.5,
    "bestMonth": "Февраль",
    "worstMonth": "Июль",
    "lossMonths": 0,
    "reserve": "Наличные операционные траты",
    "reserveAmount": 0.192,
    "inventoryEffect": -0.004,
    "narrative": "Маржа 8.9% не ниже сети (4.8%); валовая маржа 26.5% поддерживает положительный результат."
  },
  {
    "store": "А1",
    "revenue": 28.373,
    "netProfit": 1.989,
    "netMargin": 7.0,
    "grossMargin": 27.2,
    "bestMonth": "Март",
    "worstMonth": "Август",
    "lossMonths": 0,
    "reserve": "Наличные операционные траты",
    "reserveAmount": 0.092,
    "inventoryEffect": 0.016,
    "narrative": "Маржа 7.0% не ниже сети (4.8%); валовая маржа 27.2% поддерживает положительный результат."
  },
  {
    "store": "ПОЛ",
    "revenue": 16.469,
    "netProfit": 1.51,
    "netMargin": 9.2,
    "grossMargin": 27.1,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 1,
    "reserve": "Списания",
    "reserveAmount": 0.201,
    "inventoryEffect": -0.025,
    "narrative": "Маржа 9.2% не ниже сети (4.8%); валовая маржа 27.1% поддерживает положительный результат."
  },
  {
    "store": "КОВ",
    "revenue": 26.892,
    "netProfit": 1.507,
    "netMargin": 5.6,
    "grossMargin": 27.8,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 1,
    "reserve": "Аренда",
    "reserveAmount": 0.518,
    "inventoryEffect": -0.02,
    "narrative": "Маржа 5.6% не ниже сети (4.8%); валовая маржа 27.8% поддерживает положительный результат."
  },
  {
    "store": "КИР3",
    "revenue": 17.029,
    "netProfit": 1.475,
    "netMargin": 8.7,
    "grossMargin": 26.1,
    "bestMonth": "Апрель",
    "worstMonth": "Май",
    "lossMonths": 1,
    "reserve": "Банковская комиссия",
    "reserveAmount": 0.014,
    "inventoryEffect": -0.14,
    "narrative": "Маржа 8.7% не ниже сети (4.8%); валовая маржа 26.1% поддерживает положительный результат."
  },
  {
    "store": "КА2",
    "revenue": 14.448,
    "netProfit": 1.426,
    "netMargin": 9.9,
    "grossMargin": 29.3,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 0,
    "reserve": "Налог с валовой прибыли",
    "reserveAmount": 0.056,
    "inventoryEffect": 0.334,
    "narrative": "Маржа 9.9% не ниже сети (4.8%); валовая маржа 29.3% поддерживает положительный результат."
  },
  {
    "store": "ЗАП",
    "revenue": 22.327,
    "netProfit": 1.423,
    "netMargin": 6.4,
    "grossMargin": 26.0,
    "bestMonth": "Апрель",
    "worstMonth": "Июнь",
    "lossMonths": 1,
    "reserve": "Списания",
    "reserveAmount": 0.079,
    "inventoryEffect": 0.012,
    "narrative": "Маржа 6.4% не ниже сети (4.8%); валовая маржа 26.0% поддерживает положительный результат."
  },
  {
    "store": "КНИП",
    "revenue": 30.645,
    "netProfit": 1.13,
    "netMargin": 3.7,
    "grossMargin": 24.3,
    "bestMonth": "Февраль",
    "worstMonth": "Июнь",
    "lossMonths": 2,
    "reserve": "Списания",
    "reserveAmount": 0.342,
    "inventoryEffect": 0.029,
    "narrative": "Маржа 3.7% ниже сети (4.8%); основной резерв — Списания 341,518 руб."
  },
  {
    "store": "ГС2",
    "revenue": 16.897,
    "netProfit": 0.926,
    "netMargin": 5.5,
    "grossMargin": 25.7,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 1,
    "reserve": "Коммунальные платежи",
    "reserveAmount": 0.15,
    "inventoryEffect": 0.008,
    "narrative": "Маржа 5.5% не ниже сети (4.8%); валовая маржа 25.7% поддерживает положительный результат."
  },
  {
    "store": "С1",
    "revenue": 24.543,
    "netProfit": 0.848,
    "netMargin": 3.5,
    "grossMargin": 25.1,
    "bestMonth": "Июнь",
    "worstMonth": "Август",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.267,
    "inventoryEffect": 0.309,
    "narrative": "Маржа 3.5% ниже сети (4.8%); основной резерв — ФОТ и налоги 266,546 руб."
  },
  {
    "store": "К49",
    "revenue": 17.529,
    "netProfit": 0.667,
    "netMargin": 3.8,
    "grossMargin": 26.0,
    "bestMonth": "Январь",
    "worstMonth": "Июль",
    "lossMonths": 2,
    "reserve": "Аренда",
    "reserveAmount": 0.241,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 3.8% ниже сети (4.8%); основной резерв — Аренда 241,059 руб."
  },
  {
    "store": "Л76",
    "revenue": 13.241,
    "netProfit": 0.605,
    "netMargin": 4.6,
    "grossMargin": 24.3,
    "bestMonth": "Август",
    "worstMonth": "Май",
    "lossMonths": 2,
    "reserve": "Списания",
    "reserveAmount": 0.151,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 4.6% ниже сети (4.8%); основной резерв — Списания 151,083 руб."
  },
  {
    "store": "А3",
    "revenue": 13.836,
    "netProfit": 0.582,
    "netMargin": 4.2,
    "grossMargin": 26.5,
    "bestMonth": "Июнь",
    "worstMonth": "Май",
    "lossMonths": 1,
    "reserve": "Аренда",
    "reserveAmount": 0.314,
    "inventoryEffect": -0.013,
    "narrative": "Маржа 4.2% ниже сети (4.8%); основной резерв — Аренда 314,123 руб."
  },
  {
    "store": "СНЕЖ",
    "revenue": 12.105,
    "netProfit": 0.545,
    "netMargin": 4.5,
    "grossMargin": 26.1,
    "bestMonth": "Январь",
    "worstMonth": "Май",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.191,
    "inventoryEffect": 0.024,
    "narrative": "Маржа 4.5% ниже сети (4.8%); основной резерв — ФОТ и налоги 190,539 руб."
  },
  {
    "store": "ГС1",
    "revenue": 17.67,
    "netProfit": 0.332,
    "netMargin": 1.9,
    "grossMargin": 26.1,
    "bestMonth": "Февраль",
    "worstMonth": "Июль",
    "lossMonths": 1,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.594,
    "inventoryEffect": -0.001,
    "narrative": "Маржа 1.9% ниже сети (4.8%); основной резерв — ФОТ и налоги 593,648 руб."
  },
  {
    "store": "К80",
    "revenue": 11.855,
    "netProfit": 0.261,
    "netMargin": 2.2,
    "grossMargin": 25.9,
    "bestMonth": "Январь",
    "worstMonth": "Июнь",
    "lossMonths": 3,
    "reserve": "Списания",
    "reserveAmount": 0.491,
    "inventoryEffect": -0.022,
    "narrative": "Маржа 2.2% ниже сети (4.8%); основной резерв — Списания 490,950 руб."
  },
  {
    "store": "ЗАО",
    "revenue": 10.821,
    "netProfit": 0.11,
    "netMargin": 1.0,
    "grossMargin": 26.4,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.591,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 1.0% ниже сети (4.8%); основной резерв — ФОТ и налоги 590,893 руб."
  },
  {
    "store": "ПЗ2",
    "revenue": 12.429,
    "netProfit": 0.089,
    "netMargin": 0.7,
    "grossMargin": 25.6,
    "bestMonth": "Февраль",
    "worstMonth": "Май",
    "lossMonths": 4,
    "reserve": "Аренда",
    "reserveAmount": 0.319,
    "inventoryEffect": -0.016,
    "narrative": "Маржа 0.7% ниже сети (4.8%); основной резерв — Аренда 318,596 руб."
  },
  {
    "store": "КИР2",
    "revenue": 11.628,
    "netProfit": 0.011,
    "netMargin": 0.1,
    "grossMargin": 26.9,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 3,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.441,
    "inventoryEffect": -0.014,
    "narrative": "Маржа 0.1% ниже сети (4.8%); основной резерв — ФОТ и налоги 441,199 руб."
  },
  {
    "store": "С2",
    "revenue": 10.991,
    "netProfit": -0.073,
    "netMargin": -0.7,
    "grossMargin": 27.2,
    "bestMonth": "Февраль",
    "worstMonth": "Май",
    "lossMonths": 2,
    "reserve": "Аренда",
    "reserveAmount": 1.174,
    "inventoryEffect": -0.882,
    "narrative": "Убыток 73,382 руб. при марже -0.7%; главный резерв — Аренда 1,174,300 руб. сверх медианной доли сети."
  },
  {
    "store": "РОС",
    "revenue": 10.292,
    "netProfit": -0.114,
    "netMargin": -1.1,
    "grossMargin": 26.6,
    "bestMonth": "Март",
    "worstMonth": "Май",
    "lossMonths": 4,
    "reserve": "Коммунальные платежи",
    "reserveAmount": 0.312,
    "inventoryEffect": -0.013,
    "narrative": "Убыток 113,873 руб. при марже -1.1%; главный резерв — Коммунальные платежи 312,072 руб. сверх медианной доли сети."
  },
  {
    "store": "ПЗ1",
    "revenue": 10.944,
    "netProfit": -0.139,
    "netMargin": -1.3,
    "grossMargin": 25.0,
    "bestMonth": "Август",
    "worstMonth": "Июль",
    "lossMonths": 6,
    "reserve": "Аренда",
    "reserveAmount": 0.336,
    "inventoryEffect": -0.027,
    "narrative": "Убыток 139,244 руб. при марже -1.3%; главный резерв — Аренда 336,138 руб. сверх медианной доли сети."
  },
  {
    "store": "МОН",
    "revenue": 16.422,
    "netProfit": -0.181,
    "netMargin": -1.1,
    "grossMargin": 25.8,
    "bestMonth": "Апрель",
    "worstMonth": "Июль",
    "lossMonths": 5,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.461,
    "inventoryEffect": -0.008,
    "narrative": "Убыток 181,407 руб. при марже -1.1%; главный резерв — ФОТ и налоги 461,134 руб. сверх медианной доли сети."
  },
  {
    "store": "МИРА",
    "revenue": 8.823,
    "netProfit": -0.182,
    "netMargin": -2.1,
    "grossMargin": 27.1,
    "bestMonth": "Март",
    "worstMonth": "Май",
    "lossMonths": 4,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.512,
    "inventoryEffect": -0.041,
    "narrative": "Убыток 182,336 руб. при марже -2.1%; главный резерв — ФОТ и налоги 511,948 руб. сверх медианной доли сети."
  },
  {
    "store": "П.ЗОР",
    "revenue": 16.578,
    "netProfit": -0.252,
    "netMargin": -1.5,
    "grossMargin": 27.8,
    "bestMonth": "Февраль",
    "worstMonth": "Май",
    "lossMonths": 3,
    "reserve": "Наличные операционные траты",
    "reserveAmount": 0.483,
    "inventoryEffect": 0.043,
    "narrative": "Убыток 252,262 руб. при марже -1.5%; главный резерв — Наличные операционные траты 482,947 руб. сверх медианной доли сети."
  },
  {
    "store": "УМБА",
    "revenue": 8.391,
    "netProfit": -0.355,
    "netMargin": -4.2,
    "grossMargin": 26.4,
    "bestMonth": "Август",
    "worstMonth": "Май",
    "lossMonths": 6,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.519,
    "inventoryEffect": -0.001,
    "narrative": "Убыток 354,900 руб. при марже -4.2%; главный резерв — ФОТ и налоги 518,628 руб. сверх медианной доли сети."
  },
  {
    "store": "МАК",
    "revenue": 7.978,
    "netProfit": -0.546,
    "netMargin": -6.8,
    "grossMargin": 26.8,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 6,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.688,
    "inventoryEffect": -0.001,
    "narrative": "Убыток 546,371 руб. при марже -6.8%; главный резерв — ФОТ и налоги 687,842 руб. сверх медианной доли сети."
  },
  {
    "store": "С3",
    "revenue": 8.149,
    "netProfit": -0.563,
    "netMargin": -6.9,
    "grossMargin": 25.5,
    "bestMonth": "Март",
    "worstMonth": "Июль",
    "lossMonths": 7,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.646,
    "inventoryEffect": 0.298,
    "narrative": "Убыток 563,496 руб. при марже -6.9%; главный резерв — ФОТ и налоги 646,032 руб. сверх медианной доли сети."
  },
  {
    "store": "НИК",
    "revenue": 9.943,
    "netProfit": -0.805,
    "netMargin": -8.1,
    "grossMargin": 25.6,
    "bestMonth": "Январь",
    "worstMonth": "Апрель",
    "lossMonths": 8,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 0.554,
    "inventoryEffect": -0.041,
    "narrative": "Убыток 805,364 руб. при марже -8.1%; главный резерв — ФОТ и налоги 554,377 руб. сверх медианной доли сети."
  },
  {
    "store": "Н95",
    "revenue": 13.734,
    "netProfit": -1.101,
    "netMargin": -8.0,
    "grossMargin": 26.9,
    "bestMonth": "Март",
    "worstMonth": "Февраль",
    "lossMonths": 8,
    "reserve": "ФОТ и налоги",
    "reserveAmount": 1.274,
    "inventoryEffect": -0.022,
    "narrative": "Убыток 1,101,325 руб. при марже -8.0%; главный резерв — ФОТ и налоги 1,273,825 руб. сверх медианной доли сети."
  }
];

export const actionPlan = [
  {
    "point": "Н95",
    "target": "1.10 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "1.27 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "НИК",
    "target": "0.81 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.55 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "С3",
    "target": "0.56 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.65 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "МАК",
    "target": "0.55 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.69 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "УМБА",
    "target": "0.35 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.52 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "П.ЗОР",
    "target": "0.25 млн ₽",
    "reserve": "Наличные операционные траты",
    "reserveAmount": "0.48 млн ₽",
    "action": "Сверить расходы с первичкой, ввести месячные лимиты и согласование отклонений."
  },
  {
    "point": "МИРА",
    "target": "0.18 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.51 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "МОН",
    "target": "0.18 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.46 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "ПЗ1",
    "target": "0.14 млн ₽",
    "reserve": "Аренда",
    "reserveAmount": "0.34 млн ₽",
    "action": "Переговоры по ставке и релокационный сценарий; решение — только при подтвержденной окупаемости."
  },
  {
    "point": "РОС",
    "target": "0.11 млн ₽",
    "reserve": "Коммунальные платежи",
    "reserveAmount": "0.31 млн ₽",
    "action": "Разобрать отклонение по статье, закрепить владельца и еженедельный контроль P&L."
  },
  {
    "point": "С2",
    "target": "0.07 млн ₽",
    "reserve": "Аренда",
    "reserveAmount": "1.17 млн ₽",
    "action": "Переговоры по ставке и релокационный сценарий; решение — только при подтвержденной окупаемости."
  }
];

export const network = {
  "revenue": 666.1,
  "grossProfit": 170.7,
  "netProfit": 31.7,
  "netMargin": 4.8,
  "lossCount": 11,
  "storeCount": 33,
  "losses": 4.3,
  "topShare": 57.3,
  "top3": [
    {
      "store": "ПОРТ",
      "revenue": 105191330.0,
      "net_profit": 9258391.5,
      "net_margin": 0.08801477745361713
    },
    {
      "store": "А2",
      "revenue": 44810244.0,
      "net_profit": 4586425.8,
      "net_margin": 0.1023521719721053
    },
    {
      "store": "КИР1",
      "revenue": 47933978.0,
      "net_profit": 4338546.42,
      "net_margin": 0.09051087769097736
    }
  ],
  "bottom3": [
    {
      "store": "Н95",
      "revenue": 13733730.0,
      "net_profit": -1101325.38,
      "net_margin": -0.08019127942663791
    },
    {
      "store": "НИК",
      "revenue": 9942876.0,
      "net_profit": -805364.02,
      "net_margin": -0.08099910126607231
    },
    {
      "store": "С3",
      "revenue": 8149460.0,
      "net_profit": -563496.04,
      "net_margin": -0.06914519980464964
    }
  ],
  "peak": {
    "month": "Март",
    "revenue": 96523806.0,
    "net_profit": 6925444.3,
    "net_margin": 0.07174856221479704
  },
  "trough": {
    "month": "Июль",
    "revenue": 77199867.0,
    "net_profit": 869487.2000000001,
    "net_margin": 0.011262806968307343
  }
} as const;

export const auditChecks = [["Исходных листов-магазинов", "43"], ["Включено в срез", "33"], ["P&L-блоков", "264"], ["Формульных ячеек", "310 723"], ["Расхождений > 0,15 руб.", "0"]] as const;
