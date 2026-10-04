import { useState, useEffect, useCallback } from 'react';

/**
 * 추첨 화면 표시 기준 — 이름으로 볼지, 사번으로 볼지.
 *
 * 기업 행사에서는 동명이인이 흔해 사번이 진짜 식별자다. 반대로 사내 교육처럼 서로 아는
 * 자리에서는 사번이 무의미하다. 어느 쪽이 주인공인지는 행사마다 달라서 강사가 고르게 한다.
 * 강사 단말의 취향이라 세션(Firebase)이 아니라 localStorage에 남긴다.
 */
const STORAGE_KEY = 'dorandoran_draw_display';

export const DRAW_DISPLAY = { NAME: 'name', EMPLOYEE_ID: 'employeeId' };

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === DRAW_DISPLAY.EMPLOYEE_ID ? value : DRAW_DISPLAY.NAME;
  } catch {
    return DRAW_DISPLAY.NAME; // 사생활 보호 모드 등 storage 접근 불가
  }
}

/** @returns {[string, (mode: string) => void]} */
export function useDrawDisplay() {
  const [mode, setMode] = useState(readStored);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* 저장 실패해도 이번 세션 동안은 동작 */ }
  }, [mode]);

  const update = useCallback((next) => {
    setMode(next === DRAW_DISPLAY.EMPLOYEE_ID ? DRAW_DISPLAY.EMPLOYEE_ID : DRAW_DISPLAY.NAME);
  }, []);

  return [mode, update];
}

/**
 * 크게 보여줄 값. 고른 기준의 값이 비어 있으면 다른 쪽으로 넘어간다 —
 * 사번만 등록된 사람을 '이름 보기'로 두었다고 빈칸이 되면 안 된다.
 */
export function drawPrimary(person, mode) {
  if (!person) return '';
  const name = person.nickname || '';
  const employeeId = person.employeeId || '';
  if (mode === DRAW_DISPLAY.EMPLOYEE_ID) return employeeId || name;
  return name || employeeId;
}

/** 작게 덧붙일 값. 주값과 같으면(둘 중 하나만 등록된 사람) 아무것도 붙이지 않는다. */
export function drawSecondary(person, mode) {
  if (!person) return '';
  const primary = drawPrimary(person, mode);
  const other = mode === DRAW_DISPLAY.EMPLOYEE_ID ? (person.nickname || '') : (person.employeeId || '');
  return other && other !== primary ? other : '';
}
