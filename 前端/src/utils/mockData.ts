// Mock 演示数据：仅在后端不可用时降级使用，界面会明确标注「演示模式」
// 数据为延边州 2016—2025 年稻谷产量（万吨）与产值估算（亿元），与后端内置数据源一致
// 来源：延边州历年《国民经济和社会发展统计公报》（产量），产值 = 产量 × 粳稻均价约 2.6 元/公斤（估算）
//
// 降级原则：只回答「数据类」问题。病虫害、栽培、政策等知识问题在后端不可用时
// 没有可信来源，宁可如实说明，也不能套一张跟问题无关的产量趋势图。

import type { AskResponse } from '../types';

export const LABELS: number[] = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export const VALUES: number[] = [17.4, 19.7, 21.91, 24.09, 24.22, 25.22, 22.78, 22.62, 21.93, 21.85];

// 产值估算（亿元），用于组合图第二序列，与后端 data_source 保持一致
export const REVENUE_VALUES: number[] = [4.52, 5.12, 5.7, 6.26, 6.3, 6.56, 5.92, 5.88, 5.7, 5.68];

const SOURCE = '延边州历年《国民经济和社会发展统计公报》';

const WEATHER = /降水|温度|气温|气象|降雨|天气|湿度|日照/;
const GREETING = /^(你好|您好|哈喽|hello|hi|嗨|在吗|谢谢|多谢|感谢)[!！。.~～,，\s]*$/i;
// 只有命中「数据对象词」才走本地图表；知识类问题不硬套产量数据
const DATA_QUERY = /产量|产值|万吨|销售额|数据|统计|趋势|年份|最高|最低|最大|最小|平均|均值|波动|峰值|对比|排名|市州|全省|增长|下降|变化/;

/** 纯文字回答：不出图，用于寒暄与说明当前状态 */
function textOnly(summary: string): AskResponse {
  return {
    chart_config: { chart_type: 'line', x_field: 'year', y_field: 'yield', title: '' },
    labels: [],
    values: [],
    summary,
    source: '演示模式 · 本地兜底',
  };
}

/** 构造标准响应：默认返回组合图，同时携带产量与产值两个序列 */
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
 * 只有「产量 / 趋势 / 统计」这类数据问题才出图；其余问题返回文字说明，
 * 避免出现「问病虫害、答产量趋势」的答非所问。
 * 边界问题（气象类）返回空 labels/values，由 useChat 识别为「边界提示卡」。
 */
export function getMockResponse(question: string): AskResponse {
  if (WEATHER.test(question)) {
    return {
      chart_config: { chart_type: 'line', x_field: 'year', y_field: 'yield', title: '' },
      labels: [],
      values: [],
      summary: '当前数据仅包含产量和年份，暂时无法回答关于降水量的提问。你可以试试问“产量趋势”。',
      source: SOURCE,
    };
  }

  if (GREETING.test(question)) {
    return textOnly(
      '你好！我是延边大米数据分析助手，可以回答 2016—2025 年延边州稻谷产量趋势、峰值、年均值和各市州对比这类数据问题。试试问「2016—2025 年产量趋势」。',
    );
  }

  // 知识类问题（病虫害、栽培、政策等）没有可用的本地可信来源，如实说明而不是硬编
  if (!DATA_QUERY.test(question)) {
    return textOnly(
      '后端 AI 服务当前不可用（演示模式），这个问题暂时没法回答。' +
        '请确认后端已在 8000 端口启动；若只是没配 LLM_API_KEY，后端会自动改用内置知识库作答。' +
        '你也可以先问「2016—2025 年产量趋势」这类内置数据问题。',
    );
  }

  if (/平均|均值|年均/.test(question)) {
    const avg = VALUES.reduce((a, b) => a + b, 0) / VALUES.length;
    return buildAnswer(
      '2016—2025 年延边水稻产量',
      `2016—2025 年延边州水稻年均产量约为 ${avg.toFixed(2)} 万吨，多数年份稳定在 22 万吨上下。`,
    );
  }

  if (/最高|最大|最多/.test(question)) {
    const { year, value } = maxYear();
    return buildAnswer(
      '2016—2025 年延边水稻产量',
      `产量最高的年份是 ${year} 年，约为 ${value.toFixed(2)} 万吨。`,
      'bar',
    );
  }

  if (/波动|变化最大|起伏/.test(question)) {
    const { year, delta } = maxDeltaYear();
    const dir = delta > 0 ? '上升' : '下降';
    return buildAnswer(
      '2016—2025 年延边水稻产量',
      `产量波动最大的年份是 ${year} 年，较前一年${dir}约 ${Math.abs(delta).toFixed(2)} 万吨。`,
    );
  }

  return buildAnswer(
    '2016—2025 年水稻产量趋势',
    '从 2016 年到 2025 年，延边州稻谷产量整体呈先升后降的倒 U 型走势，2021 年达到峰值后小幅回落。',
  );
}
