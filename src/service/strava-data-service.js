/**
 * @typedef {object} DayRunSummary
 * @property {string} type - 活動類型。
 * @property {number} totalMeters - 該類型當日總距離（公尺）。
 */

/**
 * @typedef {object} DayActivities
 * @property {string} dateKey - 日期 key（YYYY-MM-DD 格式）。
 * @property {number} day - 日期數字（1-31）。
 * @property {DayRunSummary[]} runs - 各類型跑步摘要（已聚合）。
 * @property {number} totalMeters - 當日全類型總距離（公尺）。
 */

/**
 * @typedef {object} MonthTypeSummary
 * @property {string} type - 活動類型。
 * @property {number} totalMeters - 該類型當月總距離（公尺）。
 * @property {string} label - 顯示標籤（如「戶外」「室內」「越野」）。
 */

/**
 * @typedef {object} MonthSummary
 * @property {number} totalMeters - 當月全類型總距離（公尺）。
 * @property {MonthTypeSummary[]} byType - 各類型小計（僅含有紀錄的類型）。
 */

/** @type {Record<string, string>} 活動類型對應的中文標籤。 */
const RUN_TYPE_LABELS = {
  Run: '戶外',
  VirtualRun: '室內',
  TrailRun: '越野',
};

/** @type {string[]} 類型固定排序順序。 */
const TYPE_ORDER = ['Run', 'VirtualRun', 'TrailRun'];

/**
 * 將活動列表按日期分組並聚合同類型距離。
 * @param {import('@/lib/firebase-strava').StravaActivity[]} activities - 活動列表。
 * @returns {Map<number, DayActivities>} 以日期數字為 key 的聚合 map。
 */
export function groupActivitiesByDay(activities) {
  /** @type {Map<number, { dateKey: string, day: number, typeMap: Map<string, number> }>} */
  const intermediate = new Map();

  activities.forEach((activity) => {
    const { startDateLocal, type, distanceMeters } = activity;
    const dateKey = startDateLocal.slice(0, 10);
    const day = parseInt(dateKey.split('-')[2], 10);

    if (!intermediate.has(day)) {
      intermediate.set(day, { dateKey, day, typeMap: new Map() });
    }

    const entry = intermediate.get(day);
    entry.typeMap.set(type, (entry.typeMap.get(type) || 0) + distanceMeters);
  });

  /** @type {Map<number, DayActivities>} */
  const result = new Map();

  Array.from(intermediate.entries()).forEach(([day, { dateKey, typeMap }]) => {
    /** @type {DayRunSummary[]} */
    const runs = TYPE_ORDER.filter((type) => typeMap.has(type)).map((type) => ({
      type,
      totalMeters: /** @type {number} */ (typeMap.get(type)),
    }));

    const totalMeters = runs.reduce((sum, run) => sum + run.totalMeters, 0);
    result.set(day, { dateKey, day, runs, totalMeters });
  });

  return result;
}

/**
 * 計算月份跑步總結。
 * @param {Map<number, DayActivities>} dayMap - 每日聚合資料。
 * @returns {MonthSummary} 月份總結。
 */
export function calcMonthSummary(dayMap) {
  /** @type {Map<string, number>} */
  const typeAccum = new Map();
  let totalMeters = 0;

  Array.from(dayMap.values()).forEach((dayData) => {
    totalMeters += dayData.totalMeters;
    dayData.runs.forEach((run) => {
      typeAccum.set(run.type, (typeAccum.get(run.type) || 0) + run.totalMeters);
    });
  });

  /** @type {MonthTypeSummary[]} */
  const byType = TYPE_ORDER.filter((type) => typeAccum.has(type)).map((type) => ({
    type,
    totalMeters: /** @type {number} */ (typeAccum.get(type)),
    label: RUN_TYPE_LABELS[type] || type,
  }));

  return { totalMeters, byType };
}
