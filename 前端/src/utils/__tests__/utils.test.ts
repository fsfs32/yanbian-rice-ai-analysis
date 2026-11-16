// 前端纯函数单元测试：KPI 计算、单位显示、响应校验
// 这几块是「数据算错」与「结构与后端不一致」的高发地带，用测试锁住
import { describe, expect, it } from 'vitest';
import { calcKpi, formatNumber, formatWan } from '../calcKpi';
import { FIELD_LABEL } from '../chartOption';
import { getMockResponse } from '../mockData';
import { validateAskResponse } from '../validateAskResponse';

describe('calcKpi 指标计算', () => {
  it('按年份序列算出总量、峰值年份与均值', () => {
    const result = calcKpi(['2016', '2017', '2018'], [17.4, 19.7, 21.91]);
    expect(result.total).toBeCloseTo(59.01, 2);
    expect(result.maxYear).toBe('2018');
    expect(result.maxValue).toBeCloseTo(21.91, 2);
    expect(result.avg).toBeCloseTo(19.67, 2);
  });

  it('单元素时均值等于自身', () => {
    const result = calcKpi([2025], [21.85]);
    expect(result.maxYear).toBe(2025);
    expect(result.avg).toBeCloseTo(21.85, 2);
  });

  it('空序列不会抛错，均值归零', () => {
    const result = calcKpi([], []);
    expect(result.total).toBe(0);
    expect(result.avg).toBe(0);
  });

  it('年份乱序时仍能取到正确的峰值年份', () => {
    const result = calcKpi(['2025', '2021', '2016'], [21.85, 25.22, 17.4]);
    expect(result.maxYear).toBe('2021');
  });
});

describe('单位显示', () => {
  it('产量单位是万吨，与数据源口径一致', () => {
    // 数据源里的产量是 21.85 这类万吨数值；这里锁死标签，防止再写回「吨」
    expect(FIELD_LABEL.yield).toBe('产量（万吨）');
    expect(FIELD_LABEL.yield).not.toContain('产量（吨）');
  });

  it('产值单位是亿元', () => {
    expect(FIELD_LABEL.revenue).toBe('销售额（亿元）');
  });

  it('万吨格式化保留一位小数', () => {
    expect(formatWan(21.85)).toBe('21.9 万吨');
    expect(formatWan(25.22)).toBe('25.2 万吨');
  });

  it('千分位格式化取整', () => {
    expect(formatNumber(12345.6)).toBe('12,346');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('validateAskResponse 结构校验', () => {
  const valid = {
    chart_config: { chart_type: 'line', x_field: 'year', y_field: 'yield', title: '产量趋势' },
    labels: ['2016', '2017'],
    values: [17.4, 19.7],
    summary: '产量稳步上升',
  };

  it('合法响应能通过', () => {
    const result = validateAskResponse(valid);
    expect(result.ok).toBe(true);
  });

  it('缺少 summary 判定失败', () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.summary;
    const result = validateAskResponse(rest);
    expect(result.ok).toBe(false);
  });

  it('非法图表类型判定失败', () => {
    const result = validateAskResponse({
      ...valid,
      chart_config: { ...valid.chart_config, chart_type: 'radar' },
    });
    expect(result.ok).toBe(false);
  });

  it('labels 与 values 长度不一致判定失败', () => {
    const result = validateAskResponse({ ...valid, labels: ['2016'], values: [17.4, 19.7] });
    expect(result.ok).toBe(false);
  });

  it('非对象输入判定失败', () => {
    expect(validateAskResponse(null).ok).toBe(false);
    expect(validateAskResponse('字符串').ok).toBe(false);
  });
});

describe('演示兜底不与问题打架', () => {
  it('知识类问题不硬套产量趋势图', () => {
    const res = getMockResponse('稻瘟病怎么防治?');
    expect(res.labels).toHaveLength(0);
    expect(res.values).toHaveLength(0);
    expect(res.summary).toContain('演示模式');
    expect(res.summary).not.toContain('倒 U');
  });

  it('数据类问题仍按内置数据出图', () => {
    const res = getMockResponse('2016 到 2025 年产量趋势');
    expect(res.labels).toHaveLength(10);
    expect(res.values).toHaveLength(10);
    expect(res.summary).toContain('倒 U');
  });

  it('寒暄不进产量图', () => {
    const res = getMockResponse('你好');
    expect(res.labels).toHaveLength(0);
  });
});
