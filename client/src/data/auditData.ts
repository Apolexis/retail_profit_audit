/** AuditLine: corrected Jan–Aug 2026 base; warm-paper investment-committee report. */

export type StoreProfile = { store:string; revenue:number; netProfit:number; netMargin:number; grossMargin:number; bestMonth:string; worstMonth:string; lossMonths:number; reserve:string; reserveAmount:number; inventoryEffect:number; narrative:string; profitRank:number; monthlyProfit:{month:string;profit:number}[]; };

export const monthlyData = [
  {
    "month": "Янв",
    "revenue": 76.1,
    "profit": 5.42,
    "margin": 7.1
  },
  {
    "month": "Фев",
    "revenue": 83.7,
    "profit": 5.44,
    "margin": 6.5
  },
  {
    "month": "Мар",
    "revenue": 94.2,
    "profit": 6.82,
    "margin": 7.2
  },
  {
    "month": "Апр",
    "revenue": 89.5,
    "profit": 4.52,
    "margin": 5.1
  },
  {
    "month": "Май",
    "revenue": 75.1,
    "profit": 1.43,
    "margin": 1.9
  },
  {
    "month": "Июн",
    "revenue": 75.1,
    "profit": 2.53,
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
    "value": 487.4,
    "color": "#1e4d3b"
  },
  {
    "name": "ФОТ и налоги",
    "value": 60.0,
    "color": "#3f7663"
  },
  {
    "name": "Аренда",
    "value": 22.2,
    "color": "#7fa89b"
  },
  {
    "name": "Налог с валовой прибыли",
    "value": 20.1,
    "color": "#b8995c"
  },
  {
    "name": "Банковская комиссия",
    "value": 11.1,
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
    "value": 6.9,
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
    "value": -0.32
  },
  {
    "name": "Уценка (уменьшение остатка)",
    "value": -0.89
  },
  {
    "name": "Переоценка (увеличение остатка)",
    "value": 0.87
  },
  {
    "name": "Чистый эффект на остаток",
    "value": 0.69
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
    "reserveAmount": 0.071,
    "inventoryEffect": -0.075,
    "narrative": "Маржа 8.8% не ниже сети (4.9%); валовая маржа 22.1% поддерживает положительный результат.",
    "profitRank": 1,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.76
      },
      {
        "month": "Фев",
        "profit": 0.93
      },
      {
        "month": "Мар",
        "profit": 0.99
      },
      {
        "month": "Апр",
        "profit": 0.98
      },
      {
        "month": "Май",
        "profit": 0.8
      },
      {
        "month": "Июн",
        "profit": 1.34
      },
      {
        "month": "Июл",
        "profit": 1.71
      },
      {
        "month": "Авг",
        "profit": 1.75
      }
    ]
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
    "narrative": "Маржа 10.2% не ниже сети (4.9%); валовая маржа 26.6% поддерживает положительный результат.",
    "profitRank": 2,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.6
      },
      {
        "month": "Фев",
        "profit": 0.69
      },
      {
        "month": "Мар",
        "profit": 0.77
      },
      {
        "month": "Апр",
        "profit": 0.72
      },
      {
        "month": "Май",
        "profit": 0.56
      },
      {
        "month": "Июн",
        "profit": 0.53
      },
      {
        "month": "Июл",
        "profit": 0.3
      },
      {
        "month": "Авг",
        "profit": 0.42
      }
    ]
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
    "narrative": "Маржа 9.1% не ниже сети (4.9%); валовая маржа 25.9% поддерживает положительный результат.",
    "profitRank": 3,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.69
      },
      {
        "month": "Фев",
        "profit": 0.66
      },
      {
        "month": "Мар",
        "profit": 0.98
      },
      {
        "month": "Апр",
        "profit": 1.13
      },
      {
        "month": "Май",
        "profit": 0.29
      },
      {
        "month": "Июн",
        "profit": -0.02
      },
      {
        "month": "Июл",
        "profit": 0.16
      },
      {
        "month": "Авг",
        "profit": 0.45
      }
    ]
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
    "reserveAmount": 0.186,
    "inventoryEffect": -0.004,
    "narrative": "Маржа 8.9% не ниже сети (4.9%); валовая маржа 26.5% поддерживает положительный результат.",
    "profitRank": 4,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.33
      },
      {
        "month": "Фев",
        "profit": 0.5
      },
      {
        "month": "Мар",
        "profit": 0.39
      },
      {
        "month": "Апр",
        "profit": 0.24
      },
      {
        "month": "Май",
        "profit": 0.14
      },
      {
        "month": "Июн",
        "profit": 0.36
      },
      {
        "month": "Июл",
        "profit": 0.05
      },
      {
        "month": "Авг",
        "profit": 0.42
      }
    ]
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
    "reserve": "Аренда",
    "reserveAmount": 0.092,
    "inventoryEffect": 0.016,
    "narrative": "Маржа 7.0% не ниже сети (4.9%); валовая маржа 27.2% поддерживает положительный результат.",
    "profitRank": 5,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.28
      },
      {
        "month": "Фев",
        "profit": 0.36
      },
      {
        "month": "Мар",
        "profit": 0.52
      },
      {
        "month": "Апр",
        "profit": 0.28
      },
      {
        "month": "Май",
        "profit": 0.16
      },
      {
        "month": "Июн",
        "profit": 0.28
      },
      {
        "month": "Июл",
        "profit": 0.07
      },
      {
        "month": "Авг",
        "profit": 0.03
      }
    ]
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
    "reserveAmount": 0.2,
    "inventoryEffect": -0.025,
    "narrative": "Маржа 9.2% не ниже сети (4.9%); валовая маржа 27.1% поддерживает положительный результат.",
    "profitRank": 6,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.29
      },
      {
        "month": "Фев",
        "profit": 0.21
      },
      {
        "month": "Мар",
        "profit": 0.41
      },
      {
        "month": "Апр",
        "profit": 0.17
      },
      {
        "month": "Май",
        "profit": 0.16
      },
      {
        "month": "Июн",
        "profit": 0.12
      },
      {
        "month": "Июл",
        "profit": -0.02
      },
      {
        "month": "Авг",
        "profit": 0.18
      }
    ]
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
    "reserveAmount": 0.548,
    "inventoryEffect": -0.02,
    "narrative": "Маржа 5.6% не ниже сети (4.9%); валовая маржа 27.8% поддерживает положительный результат.",
    "profitRank": 7,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.26
      },
      {
        "month": "Фев",
        "profit": 0.3
      },
      {
        "month": "Мар",
        "profit": 0.38
      },
      {
        "month": "Апр",
        "profit": 0.32
      },
      {
        "month": "Май",
        "profit": 0.06
      },
      {
        "month": "Июн",
        "profit": 0.06
      },
      {
        "month": "Июл",
        "profit": -0.03
      },
      {
        "month": "Авг",
        "profit": 0.15
      }
    ]
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
    "narrative": "Маржа 8.7% не ниже сети (4.9%); валовая маржа 26.1% поддерживает положительный результат.",
    "profitRank": 8,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.22
      },
      {
        "month": "Фев",
        "profit": 0.29
      },
      {
        "month": "Мар",
        "profit": 0.44
      },
      {
        "month": "Апр",
        "profit": 0.45
      },
      {
        "month": "Май",
        "profit": -0.01
      },
      {
        "month": "Июн",
        "profit": 0.07
      },
      {
        "month": "Июл",
        "profit": 0.01
      },
      {
        "month": "Авг",
        "profit": 0.0
      }
    ]
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
    "narrative": "Маржа 9.9% не ниже сети (4.9%); валовая маржа 29.3% поддерживает положительный результат.",
    "profitRank": 9,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.23
      },
      {
        "month": "Фев",
        "profit": 0.23
      },
      {
        "month": "Мар",
        "profit": 0.26
      },
      {
        "month": "Апр",
        "profit": 0.21
      },
      {
        "month": "Май",
        "profit": 0.14
      },
      {
        "month": "Июн",
        "profit": 0.07
      },
      {
        "month": "Июл",
        "profit": 0.03
      },
      {
        "month": "Авг",
        "profit": 0.25
      }
    ]
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
    "reserveAmount": 0.077,
    "inventoryEffect": 0.012,
    "narrative": "Маржа 6.4% не ниже сети (4.9%); валовая маржа 26.0% поддерживает положительный результат.",
    "profitRank": 10,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.23
      },
      {
        "month": "Фев",
        "profit": 0.21
      },
      {
        "month": "Мар",
        "profit": 0.13
      },
      {
        "month": "Апр",
        "profit": 0.26
      },
      {
        "month": "Май",
        "profit": 0.19
      },
      {
        "month": "Июн",
        "profit": -0.02
      },
      {
        "month": "Июл",
        "profit": 0.19
      },
      {
        "month": "Авг",
        "profit": 0.25
      }
    ]
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
    "reserve": "Аренда",
    "reserveAmount": 0.359,
    "inventoryEffect": 0.029,
    "narrative": "Маржа 3.7% ниже сети (4.9%); основной резерв — Аренда 358,715 руб.",
    "profitRank": 11,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.29
      },
      {
        "month": "Фев",
        "profit": 0.3
      },
      {
        "month": "Мар",
        "profit": 0.21
      },
      {
        "month": "Апр",
        "profit": -0.05
      },
      {
        "month": "Май",
        "profit": 0.13
      },
      {
        "month": "Июн",
        "profit": -0.12
      },
      {
        "month": "Июл",
        "profit": 0.1
      },
      {
        "month": "Авг",
        "profit": 0.28
      }
    ]
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
    "reserveAmount": 0.139,
    "inventoryEffect": 0.008,
    "narrative": "Маржа 5.5% не ниже сети (4.9%); валовая маржа 25.7% поддерживает положительный результат.",
    "profitRank": 12,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.05
      },
      {
        "month": "Фев",
        "profit": 0.13
      },
      {
        "month": "Мар",
        "profit": 0.26
      },
      {
        "month": "Апр",
        "profit": 0.02
      },
      {
        "month": "Май",
        "profit": 0.14
      },
      {
        "month": "Июн",
        "profit": 0.18
      },
      {
        "month": "Июл",
        "profit": -0.04
      },
      {
        "month": "Авг",
        "profit": 0.17
      }
    ]
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
    "reserve": "Списания",
    "reserveAmount": 0.238,
    "inventoryEffect": 0.309,
    "narrative": "Маржа 3.5% ниже сети (4.9%); основной резерв — Списания 238,099 руб.",
    "profitRank": 13,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.1
      },
      {
        "month": "Фев",
        "profit": 0.18
      },
      {
        "month": "Мар",
        "profit": 0.15
      },
      {
        "month": "Апр",
        "profit": 0.09
      },
      {
        "month": "Май",
        "profit": 0.12
      },
      {
        "month": "Июн",
        "profit": 0.24
      },
      {
        "month": "Июл",
        "profit": 0.04
      },
      {
        "month": "Авг",
        "profit": -0.07
      }
    ]
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
    "reserveAmount": 0.26,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 3.8% ниже сети (4.9%); основной резерв — Аренда 260,303 руб.",
    "profitRank": 14,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.22
      },
      {
        "month": "Фев",
        "profit": 0.17
      },
      {
        "month": "Мар",
        "profit": 0.2
      },
      {
        "month": "Апр",
        "profit": 0.09
      },
      {
        "month": "Май",
        "profit": 0.08
      },
      {
        "month": "Июн",
        "profit": -0.09
      },
      {
        "month": "Июл",
        "profit": -0.1
      },
      {
        "month": "Авг",
        "profit": 0.08
      }
    ]
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
    "reserveAmount": 0.15,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 4.6% ниже сети (4.9%); основной резерв — Списания 149,958 руб.",
    "profitRank": 15,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.15
      },
      {
        "month": "Фев",
        "profit": -0.01
      },
      {
        "month": "Мар",
        "profit": 0.14
      },
      {
        "month": "Апр",
        "profit": 0.03
      },
      {
        "month": "Май",
        "profit": -0.03
      },
      {
        "month": "Июн",
        "profit": 0.06
      },
      {
        "month": "Июл",
        "profit": 0.06
      },
      {
        "month": "Авг",
        "profit": 0.21
      }
    ]
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
    "reserveAmount": 0.329,
    "inventoryEffect": -0.013,
    "narrative": "Маржа 4.2% ниже сети (4.9%); основной резерв — Аренда 329,313 руб.",
    "profitRank": 16,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.04
      },
      {
        "month": "Фев",
        "profit": 0.05
      },
      {
        "month": "Мар",
        "profit": 0.11
      },
      {
        "month": "Апр",
        "profit": 0.12
      },
      {
        "month": "Май",
        "profit": -0.0
      },
      {
        "month": "Июн",
        "profit": 0.12
      },
      {
        "month": "Июл",
        "profit": 0.02
      },
      {
        "month": "Авг",
        "profit": 0.12
      }
    ]
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
    "reserveAmount": 0.125,
    "inventoryEffect": 0.024,
    "narrative": "Маржа 4.5% ниже сети (4.9%); основной резерв — ФОТ и налоги 124,806 руб.",
    "profitRank": 17,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.2
      },
      {
        "month": "Фев",
        "profit": 0.14
      },
      {
        "month": "Мар",
        "profit": 0.1
      },
      {
        "month": "Апр",
        "profit": 0.04
      },
      {
        "month": "Май",
        "profit": -0.11
      },
      {
        "month": "Июн",
        "profit": 0.07
      },
      {
        "month": "Июл",
        "profit": 0.01
      },
      {
        "month": "Авг",
        "profit": 0.09
      }
    ]
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
    "reserveAmount": 0.498,
    "inventoryEffect": -0.001,
    "narrative": "Маржа 1.9% ниже сети (4.9%); основной резерв — ФОТ и налоги 497,699 руб.",
    "profitRank": 18,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.08
      },
      {
        "month": "Фев",
        "profit": 0.17
      },
      {
        "month": "Мар",
        "profit": 0.03
      },
      {
        "month": "Апр",
        "profit": 0.04
      },
      {
        "month": "Май",
        "profit": 0.05
      },
      {
        "month": "Июн",
        "profit": 0.05
      },
      {
        "month": "Июл",
        "profit": -0.15
      },
      {
        "month": "Авг",
        "profit": 0.08
      }
    ]
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
    "reserveAmount": 0.49,
    "inventoryEffect": -0.022,
    "narrative": "Маржа 2.2% ниже сети (4.9%); основной резерв — Списания 489,942 руб.",
    "profitRank": 19,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.13
      },
      {
        "month": "Фев",
        "profit": 0.03
      },
      {
        "month": "Мар",
        "profit": 0.11
      },
      {
        "month": "Апр",
        "profit": 0.04
      },
      {
        "month": "Май",
        "profit": 0.02
      },
      {
        "month": "Июн",
        "profit": -0.05
      },
      {
        "month": "Июл",
        "profit": -0.02
      },
      {
        "month": "Авг",
        "profit": -0.01
      }
    ]
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
    "reserveAmount": 0.532,
    "inventoryEffect": -0.005,
    "narrative": "Маржа 1.0% ниже сети (4.9%); основной резерв — ФОТ и налоги 532,133 руб.",
    "profitRank": 20,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.09
      },
      {
        "month": "Фев",
        "profit": 0.07
      },
      {
        "month": "Мар",
        "profit": 0.1
      },
      {
        "month": "Апр",
        "profit": 0.04
      },
      {
        "month": "Май",
        "profit": -0.09
      },
      {
        "month": "Июн",
        "profit": -0.03
      },
      {
        "month": "Июл",
        "profit": -0.12
      },
      {
        "month": "Авг",
        "profit": 0.06
      }
    ]
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
    "reserveAmount": 0.332,
    "inventoryEffect": -0.016,
    "narrative": "Маржа 0.7% ниже сети (4.9%); основной резерв — Аренда 332,242 руб.",
    "profitRank": 21,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.09
      },
      {
        "month": "Фев",
        "profit": 0.13
      },
      {
        "month": "Мар",
        "profit": 0.03
      },
      {
        "month": "Апр",
        "profit": -0.09
      },
      {
        "month": "Май",
        "profit": -0.09
      },
      {
        "month": "Июн",
        "profit": -0.03
      },
      {
        "month": "Июл",
        "profit": -0.01
      },
      {
        "month": "Авг",
        "profit": 0.06
      }
    ]
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
    "reserveAmount": 0.378,
    "inventoryEffect": -0.014,
    "narrative": "Маржа 0.1% ниже сети (4.9%); основной резерв — ФОТ и налоги 378,057 руб.",
    "profitRank": 22,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.03
      },
      {
        "month": "Фев",
        "profit": 0.04
      },
      {
        "month": "Мар",
        "profit": 0.11
      },
      {
        "month": "Апр",
        "profit": -0.07
      },
      {
        "month": "Май",
        "profit": 0.05
      },
      {
        "month": "Июн",
        "profit": -0.01
      },
      {
        "month": "Июл",
        "profit": -0.17
      },
      {
        "month": "Авг",
        "profit": 0.03
      }
    ]
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
    "reserveAmount": 0.306,
    "inventoryEffect": -0.013,
    "narrative": "Убыток 113,873 руб. при марже -1.1%; главный резерв — Коммунальные платежи 305,685 руб. сверх медианной доли сети.",
    "profitRank": 23,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.03
      },
      {
        "month": "Фев",
        "profit": 0.06
      },
      {
        "month": "Мар",
        "profit": 0.08
      },
      {
        "month": "Апр",
        "profit": -0.03
      },
      {
        "month": "Май",
        "profit": -0.17
      },
      {
        "month": "Июн",
        "profit": -0.0
      },
      {
        "month": "Июл",
        "profit": -0.09
      },
      {
        "month": "Авг",
        "profit": 0.0
      }
    ]
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
    "reserveAmount": 0.348,
    "inventoryEffect": -0.027,
    "narrative": "Убыток 139,244 руб. при марже -1.3%; главный резерв — Аренда 348,153 руб. сверх медианной доли сети.",
    "profitRank": 24,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.05
      },
      {
        "month": "Фев",
        "profit": -0.05
      },
      {
        "month": "Мар",
        "profit": 0.07
      },
      {
        "month": "Апр",
        "profit": -0.02
      },
      {
        "month": "Май",
        "profit": -0.0
      },
      {
        "month": "Июн",
        "profit": -0.01
      },
      {
        "month": "Июл",
        "profit": -0.2
      },
      {
        "month": "Авг",
        "profit": 0.13
      }
    ]
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
    "reserve": "Коммунальные платежи",
    "reserveAmount": 0.406,
    "inventoryEffect": -0.008,
    "narrative": "Убыток 181,407 руб. при марже -1.1%; главный резерв — Коммунальные платежи 406,157 руб. сверх медианной доли сети.",
    "profitRank": 25,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.11
      },
      {
        "month": "Фев",
        "profit": -0.0
      },
      {
        "month": "Мар",
        "profit": -0.12
      },
      {
        "month": "Апр",
        "profit": 0.14
      },
      {
        "month": "Май",
        "profit": -0.07
      },
      {
        "month": "Июн",
        "profit": -0.02
      },
      {
        "month": "Июл",
        "profit": -0.22
      },
      {
        "month": "Авг",
        "profit": 0.01
      }
    ]
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
    "reserveAmount": 0.464,
    "inventoryEffect": -0.041,
    "narrative": "Убыток 182,336 руб. при марже -2.1%; главный резерв — ФОТ и налоги 464,035 руб. сверх медианной доли сети.",
    "profitRank": 26,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.04
      },
      {
        "month": "Фев",
        "profit": 0.02
      },
      {
        "month": "Мар",
        "profit": 0.06
      },
      {
        "month": "Апр",
        "profit": -0.09
      },
      {
        "month": "Май",
        "profit": -0.18
      },
      {
        "month": "Июн",
        "profit": -0.03
      },
      {
        "month": "Июл",
        "profit": -0.03
      },
      {
        "month": "Авг",
        "profit": 0.04
      }
    ]
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
    "reserveAmount": 0.479,
    "inventoryEffect": 0.043,
    "narrative": "Убыток 252,262 руб. при марже -1.5%; главный резерв — Наличные операционные траты 479,181 руб. сверх медианной доли сети.",
    "profitRank": 27,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": 0.09
      },
      {
        "month": "Фев",
        "profit": 0.12
      },
      {
        "month": "Мар",
        "profit": 0.04
      },
      {
        "month": "Апр",
        "profit": -0.15
      },
      {
        "month": "Май",
        "profit": -0.22
      },
      {
        "month": "Июн",
        "profit": -0.18
      },
      {
        "month": "Июл",
        "profit": 0.03
      },
      {
        "month": "Авг",
        "profit": 0.01
      }
    ]
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
    "reserveAmount": 0.473,
    "inventoryEffect": -0.001,
    "narrative": "Убыток 354,900 руб. при марже -4.2%; главный резерв — ФОТ и налоги 473,063 руб. сверх медианной доли сети.",
    "profitRank": 28,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.06
      },
      {
        "month": "Фев",
        "profit": -0.11
      },
      {
        "month": "Мар",
        "profit": -0.09
      },
      {
        "month": "Апр",
        "profit": -0.04
      },
      {
        "month": "Май",
        "profit": -0.17
      },
      {
        "month": "Июн",
        "profit": 0.04
      },
      {
        "month": "Июл",
        "profit": -0.04
      },
      {
        "month": "Авг",
        "profit": 0.11
      }
    ]
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
    "reserveAmount": 0.645,
    "inventoryEffect": -0.001,
    "narrative": "Убыток 546,371 руб. при марже -6.8%; главный резерв — ФОТ и налоги 644,521 руб. сверх медианной доли сети.",
    "profitRank": 29,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.01
      },
      {
        "month": "Фев",
        "profit": 0.01
      },
      {
        "month": "Мар",
        "profit": 0.06
      },
      {
        "month": "Апр",
        "profit": -0.03
      },
      {
        "month": "Май",
        "profit": -0.03
      },
      {
        "month": "Июн",
        "profit": -0.1
      },
      {
        "month": "Июл",
        "profit": -0.23
      },
      {
        "month": "Авг",
        "profit": -0.21
      }
    ]
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
    "reserveAmount": 0.602,
    "inventoryEffect": 0.298,
    "narrative": "Убыток 563,496 руб. при марже -6.9%; главный резерв — ФОТ и налоги 601,780 руб. сверх медианной доли сети.",
    "profitRank": 30,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.04
      },
      {
        "month": "Фев",
        "profit": -0.09
      },
      {
        "month": "Мар",
        "profit": 0.0
      },
      {
        "month": "Апр",
        "profit": -0.07
      },
      {
        "month": "Май",
        "profit": -0.02
      },
      {
        "month": "Июн",
        "profit": -0.07
      },
      {
        "month": "Июл",
        "profit": -0.2
      },
      {
        "month": "Авг",
        "profit": -0.08
      }
    ]
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
    "reserveAmount": 0.5,
    "inventoryEffect": -0.041,
    "narrative": "Убыток 805,364 руб. при марже -8.1%; главный резерв — ФОТ и налоги 500,385 руб. сверх медианной доли сети.",
    "profitRank": 31,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.0
      },
      {
        "month": "Фев",
        "profit": -0.03
      },
      {
        "month": "Мар",
        "profit": -0.08
      },
      {
        "month": "Апр",
        "profit": -0.2
      },
      {
        "month": "Май",
        "profit": -0.2
      },
      {
        "month": "Июн",
        "profit": -0.07
      },
      {
        "month": "Июл",
        "profit": -0.11
      },
      {
        "month": "Авг",
        "profit": -0.12
      }
    ]
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
    "reserveAmount": 1.199,
    "inventoryEffect": -0.022,
    "narrative": "Убыток 1,101,325 руб. при марже -8.0%; главный резерв — ФОТ и налоги 1,199,248 руб. сверх медианной доли сети.",
    "profitRank": 32,
    "monthlyProfit": [
      {
        "month": "Янв",
        "profit": -0.06
      },
      {
        "month": "Фев",
        "profit": -0.26
      },
      {
        "month": "Мар",
        "profit": -0.02
      },
      {
        "month": "Апр",
        "profit": -0.06
      },
      {
        "month": "Май",
        "profit": -0.24
      },
      {
        "month": "Июн",
        "profit": -0.19
      },
      {
        "month": "Июл",
        "profit": -0.16
      },
      {
        "month": "Авг",
        "profit": -0.12
      }
    ]
  }
];

export const actionPlan = [
  {
    "point": "Н95",
    "target": "1.10 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "1.20 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "НИК",
    "target": "0.81 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.50 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "С3",
    "target": "0.56 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.60 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "МАК",
    "target": "0.55 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.64 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "УМБА",
    "target": "0.35 млн ₽",
    "reserve": "ФОТ и налоги",
    "reserveAmount": "0.47 млн ₽",
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
    "reserveAmount": "0.46 млн ₽",
    "action": "Нормировать штатные часы и график к фактическому трафику; лимитировать сверхсмены."
  },
  {
    "point": "МОН",
    "target": "0.18 млн ₽",
    "reserve": "Коммунальные платежи",
    "reserveAmount": "0.41 млн ₽",
    "action": "Разобрать отклонение по статье, закрепить владельца и еженедельный контроль P&L."
  },
  {
    "point": "ПЗ1",
    "target": "0.14 млн ₽",
    "reserve": "Аренда",
    "reserveAmount": "0.35 млн ₽",
    "action": "Переговоры по ставке и релокационный сценарий; решение — только при подтвержденной окупаемости."
  },
  {
    "point": "РОС",
    "target": "0.11 млн ₽",
    "reserve": "Коммунальные платежи",
    "reserveAmount": "0.31 млн ₽",
    "action": "Разобрать отклонение по статье, закрепить владельца и еженедельный контроль P&L."
  }
];

export const network = {
  "revenue": 655.1,
  "grossProfit": 167.7,
  "netProfit": 31.8,
  "netMargin": 4.9,
  "lossCount": 10,
  "storeCount": 32,
  "losses": 4.2,
  "topShare": 57.2,
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
    "revenue": 94204544.0,
    "net_profit": 6815837.0,
    "net_margin": 0.07235146746212157
  },
  "trough": {
    "month": "Июль",
    "revenue": 77199867.0,
    "net_profit": 869487.2000000001,
    "net_margin": 0.011262806968307343
  }
} as const;

export const auditChecks = [["Исходных листов-магазинов", "43"], ["Включено в срез", "32"], ["P&L-блоков в срезе", "256"], ["Формульных ячеек", "310 723"], ["Расхождений > 0,15 руб.", "0"]] as const;
