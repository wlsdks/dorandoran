/**
 * 즉석복권(3x3) 판 생성.
 *
 * 규칙: 한 판을 열면 가로 세 줄 중 **정확히 한 줄**에만 같은 사람 3칸이 나오고, 그 줄이 당첨이다.
 * 나머지 칸은 우연히라도 3개가 맞아떨어지면 안 된다 — 당첨자가 두 명이 되어버리기 때문이다.
 * 가로뿐 아니라 세로·대각까지 막는 이유는, 화면에서 세로로 3개가 같아 보이면
 * 사람이 먼저 "저것도 당첨 아니냐"고 읽기 때문이다. 판정선은 가로지만, 눈에 걸리는 줄을 없앤다.
 */

export const BOARD_SIZE = 3;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** 가로 3 + 세로 3 + 대각 2 — 3개가 같으면 사람이 "줄"로 읽는 모든 선. */
const LINES = (() => {
  const rows = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
  const cols = [[0, 3, 6], [1, 4, 7], [2, 5, 8]];
  const diagonals = [[0, 4, 8], [2, 4, 6]];
  return [...rows, ...cols, ...diagonals];
})();

/** 판정선(가로) — 당첨 줄은 항상 이 중 하나다. */
export const ROW_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];

function shuffled(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isTriple(cells, line) {
  const [a, b, c] = line.map((i) => cells[i]?.id);
  return !!a && a === b && b === c;
}

/**
 * 3x3 즉석복권 판을 만든다.
 *
 * @param {Array<{id: string, nickname: string, employeeId?: string}>} participants 추첨 대상
 * @param {{ winner?: object, random?: () => number }} [opts] winner를 넘기면 그 사람을 당첨자로 고정
 * @returns {{ cells: Array, winningRow: number, winner: object }|null} 대상이 없으면 null
 */
export function buildScratchBoard(participants, opts = {}) {
  const people = (participants || []).filter((p) => p && p.id);
  if (people.length === 0) return null;

  const random = opts.random || Math.random;
  const winner = opts.winner && people.some((p) => p.id === opts.winner.id)
    ? opts.winner
    : people[Math.floor(random() * people.length)];

  const winningRow = Math.floor(random() * BOARD_SIZE);
  const others = people.filter((p) => p.id !== winner.id);
  // 당첨자 외에 아무도 없으면 채울 이름이 없다 — 이때만 판 전체가 당첨자로 덮인다(대상 1명).
  const fillers = others.length > 0 ? others : [winner];

  // 채움용 덱 — 사람이 적어도 칸은 9개라 덱을 반복해 쓴다.
  let deck = shuffled(fillers, random);
  let cursor = 0;
  const draw = () => {
    if (cursor >= deck.length) { deck = shuffled(fillers, random); cursor = 0; }
    const picked = deck[cursor];
    cursor += 1;
    return picked;
  };

  const cells = new Array(CELL_COUNT).fill(null);
  ROW_LINES[winningRow].forEach((index) => { cells[index] = winner; });
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (!cells[i]) cells[i] = draw();
  }

  repairAccidentalTriples(cells, winningRow, people, winner);

  return {
    cells: cells.map((person) => ({
      id: person.id,
      nickname: person.nickname,
      ...(person.employeeId ? { employeeId: person.employeeId } : {}),
    })),
    winningRow,
    winner,
  };
}

/**
 * 당첨 줄은 고정하고 나머지 여섯 칸만 탐색한다.
 * 원래 이름을 먼저 시도하고, 당첨자와 다른 한 사람을 대안으로 쓴다.
 * 두 사람만으로도 모든 당첨 행에 유효한 판을 만들 수 있어 최대 3^6 조합 안에 끝난다.
 * 한 칸의 무작위 교체를 반복하면 다른 선을 다시 완성해 순환할 수 있다.
 */
function repairAccidentalTriples(cells, winningRow, people, winner) {
  const winningLine = ROW_LINES[winningRow];
  const other = people.find((person) => person.id !== winner.id);
  if (!other) return; // 대상 한 명일 때만 전체가 같은 사람인 판을 허용한다.

  const forbiddenLines = LINES.filter((line) => !line.every((index, position) => index === winningLine[position]));
  if (!forbiddenLines.some((line) => isTriple(cells, line))) return;

  const freeIndices = cells.map((_, index) => index).filter((index) => !winningLine.includes(index));
  const candidates = freeIndices.map((index) => {
    const choices = [cells[index], winner, other];
    return choices.filter((person, position) => choices.findIndex((choice) => choice.id === person.id) === position);
  });
  freeIndices.forEach((index) => { cells[index] = null; });

  function fill(position) {
    if (position === freeIndices.length) return true;
    const index = freeIndices[position];
    for (const person of candidates[position]) {
      cells[index] = person;
      if (!forbiddenLines.some((line) => isTriple(cells, line)) && fill(position + 1)) return true;
    }
    cells[index] = null;
    return false;
  }

  // 유효한 두 사람 배치가 항상 후보에 포함된다. 실패한 판을 반환하지 않는다.
  if (!fill(0)) throw new Error('스크래치 판의 당첨 줄을 하나로 만들 수 없습니다.');
}

/** 판에서 3개가 같은 가로줄을 찾는다. 화면에서 당첨 줄을 강조할 때 쓴다. */
export function findWinningRow(cells) {
  const index = ROW_LINES.findIndex((line) => isTriple(cells, line));
  return index >= 0 ? index : null;
}
