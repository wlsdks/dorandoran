/** 보기 사진 — options와 같은 순서의 URL 배열(빈 문자열 = 사진 없음). */

/** 보기 중 하나라도 사진이 있으면 사진 카드로 보여준다. */
export function hasOptionImages(images) {
  return Array.isArray(images) && images.some(Boolean);
}

/** 사진만 있는 보기는 '사진 A'로 부른다 — 투표 값이 보기 글자라 비어 있으면 안 된다. */
export function choiceNames(options, optionImages = []) {
  return options.map((o, i) => o.trim() || (optionImages[i] ? `사진 ${String.fromCharCode(65 + i)}` : ''));
}

/** choiceNames가 자동으로 붙인 이름인지 — 화면에서는 보기 글자(A·B)와 겹치므로 따로 적지 않는다. */
export function isAutoPhotoName(name) {
  return /^사진 [A-Z]$/.test(String(name));
}
