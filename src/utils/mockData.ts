// Mock 演示数据：仅在后端不可用时降级使用，界面会明确标注「演示数据」
// 数据为延边州 1994—2016 年水稻产量的示例取值，仅供演示与界面联调

import type { AskResponse } from '../types';

export const LABELS: number[] = [
  1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009,
  2010, 2011, 2012, 2013, 2014, 2015, 2016,
];

export const VALUES: number[] = [
  172000, 178000, 184000, 181000, 190000, 196000, 188000, 195000, 201000, 199000, 208000, 214000,
  211000, 218000, 224000, 220000, 229000, 235000, 231000, 238000, 234000, 241000, 246000,
];

// 大米单价（元/吨）：随年份温和上涨，用于估算销售额（演示数据，仅作对应关系展示）
const PRICE_PER_TON = VALUES.map((_, i) => 4600 + i * 55);

/** 销售额（亿元）= 产量（吨）× 单价（元/吨）/ 1e8，用于组合图第二序列 */
export const REVENUE_VALUES: number[] = VALUES.map((v, i) =>
  Number(((v * PRICE_PER_TON[i]) / 1e8).toFixed(2)),
);

const SOURCE = '延边州统计局 · 1994—2016';

/** 构造标准响应：默认返回组合图，同时携带产量与销售额两个序列 */
function buildAnswer(
  title: string,
  summary: string,
  chartType: AskResponse['chart_config']['chart_type'] = 'combo',
): AskResponse {
  return {
    chart_config: {
      chart_type: chartType,
      x_field: 'year',
      y_field: 'yield',
      y2_field: 'revenue',
      title,
    },
    labels: LABELS,
    values: VALUES,
    values2: REVENUE_VALUES,
    summary,
    source: SOURCE,
  };
}

/** 找到产量最高的年份 */
function maxYear(): { year: number; value: number } {
  let idx = 0;
  VALUES.forEach((v, i) => {
    if (v > VALUES[idx]) idx = i;
  });
  return { year: LABELS[idx], value: VALUES[idx] };
}

/** 找到产量同比波动最大的年份 */
function maxDeltaYear(): { year: number; delta: number } {
  let idx = 1;
  let maxAbs = 0;
  for (let i = 1; i < VALUES.length; i++) {
    const abs = Math.abs(VALUES[i] - VALUES[i - 1]);
    if (abs > maxAbs) {
      maxAbs = abs;
      idx = i;
    }
  }
  return { year: LABELS[idx], delta: VALUES[idx] - VALUES[idx - 1] };
}

/**
 * 根据问题返回演示响应。
 * 边界问题（气象类）返回空 labels/values，由 useChat 识别为「边界提示卡」。
 */
export function getMockResponse(question: string): AskResponse {
  if (/降水|温度|气温|气象|降雨|天气|湿度|日照/.test(question)) {
    return {
      chart_config: { chart_type: 'line', x_field: 'year', y_field: 'yield', title: '' },
      labels: [],
      values: [],
      summary: '当前数据仅包含产量和年份，暂时无法回答关于降水量的提问。你可以试试问“产量趋势”。',
      source: SOURCE,
    };
  }

  if (/平均|均值/.test(question)) {
    const avg = VALUES.reduce((a, b) => a + b, 0) / VALUES.length;
    return buildAnswer(
      '1994—2016 年延边水稻产量',
      `1994—2016 年延边州水稻年均产量约为 ${(avg / 10000).toFixed(1)} 万吨，多数年份稳定在 20 万吨上下。`,
    );
  }

  if (/最高|最大|最多/.test(question)) {
    const { year, value } = maxYear();
    return buildAnswer(
      '1994—2016 年延边水稻产量',
      `产量最高的年份是 ${year} 年，约为 ${(value / 10000).toFixed(1)} 万吨。`,
      'bar',
    );
  }

  if (/波动|变化最大|起伏/.test(question)) {
    const { year, delta } = maxDeltaYear();
    const dir = delta > 0 ? '上升' : '下降';
    return buildAnswer(
      '1994—2016 年延边水稻产量',
      `产量波动最大的年份是 ${year} 年，较前一年${dir}约 ${Math.round(Math.abs(delta)).toLocaleString('zh-CN')} 吨。`,
    );
  }

  return buildAnswer(
    '1994—2016 年水稻产量趋势',
    '从 1994 年到 2016 年，延边州水稻产量整体呈稳步上升趋势，个别年份略有波动。',
  );
}
