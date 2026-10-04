/** Excel 열람용 CSV: 사용자 텍스트가 수식으로 평가되지 않게 인용 필드 안에 탭을 붙인다. */
export function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  const significant = [...text].find(character => character.charCodeAt(0) > 32 && !/\s/u.test(character)) || '';
  if (typeof value !== 'number' && '=+@＝＋－＠-'.includes(significant) && significant) return '"\t' + text.replace(/"/g, '""') + '"';
  return /[,"\r\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
