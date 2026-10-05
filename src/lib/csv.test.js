import { afterEach, expect, it, vi } from 'vitest';
import { exportQuestionSummary } from './csv';
afterEach(() => vi.restoreAllMocks());
it('예약 이름을 응답해도 CSV 분포에서 누락하거나 프로토타입을 변경하지 않는다', async () => {
  let download;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { download = blob; return 'blob:test'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }), body: { appendChild: vi.fn(), removeChild: vi.fn() } });
  try {
    exportQuestionSummary({ questions: { q: { type: 'wordcloud', title: '자유 응답', votes: {
      a: { value: '__proto__' }, b: { value: 'constructor' }, c: { value: 'toString' },
    } } } }, {}, 'test.csv');
    expect(create).toHaveBeenCalledOnce();
    const csv = await download.text();
    expect(csv).toContain('__proto__: 1명'); expect(csv).toContain('constructor: 1명'); expect(csv).toContain('toString: 1명');
    expect(Object.prototype.count).toBeUndefined();
  } finally { vi.unstubAllGlobals(); }
});
