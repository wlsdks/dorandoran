import { expect, it } from 'vitest';
import { csvCell } from './csv-cell';
it('사용자 수식은 Excel 인용 필드 안의 탭 뒤에 둔다', () => {
  for (const input of ['=1+2', '+cmd', '-1+2', '@SUM(A1)', '  =1+2', '＝1+2']) expect(csvCell(input)).toBe('"\t' + input + '"');
  expect(csvCell(-30)).toBe('-30'); expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('a"b')).toBe('"a""b"');
});
