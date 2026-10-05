import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('../../public/storage-upgrade.js', import.meta.url), 'utf8');

function storage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

function upgrade(localStorage = storage(), sessionStorage = storage()) {
  runInNewContext(script, { window: { localStorage, sessionStorage } });
}

describe('브랜드 변경 시 저장 데이터 유지', () => {
  it('참가자, 테마, 읽음 상태, 강사 메모와 로그인을 새 키로 옮긴다', () => {
    const joined = JSON.stringify({ lesson: { participantId: 'student-1', nickname: '김학생' } });
    const local = storage({ previous_participant_id: 'student-1', previous_joined_sessions: joined,
      previous_nickname: '김학생', previous_theme: 'light',
      earlier_notes_lesson: '["다음 수업 메모"]', earlier_chat_seen_lesson: '7' });
    const session = storage({ previous_admin: '{"uid":"teacher-1"}', earlier_autoOpened_lesson_question: '1' });
    upgrade(local, session);
    expect(local.getItem('dorandoran_participant_id')).toBe('student-1');
    expect(local.getItem('dorandoran_joined_sessions')).toBe(joined);
    expect(local.getItem('dorandoran_nickname')).toBe('김학생');
    expect(local.getItem('dorandoran_theme')).toBe('light');
    expect(local.getItem('dorandoran_notes_lesson')).toBe('["다음 수업 메모"]');
    expect(local.getItem('dorandoran_chat_seen_lesson')).toBe('7');
    expect(session.getItem('dorandoran_admin')).toBe('{"uid":"teacher-1"}');
    expect(session.getItem('dorandoran_autoOpened_lesson_question')).toBe('1');
    expect(local.getItem('previous_participant_id')).toBeNull();
    expect(session.getItem('previous_admin')).toBeNull();
  });

  it('이미 있는 새 데이터를 우선하고 반복 실행해도 값이 유지된다', () => {
    const local = storage({ previous_participant_id: 'old', dorandoran_participant_id: 'current' });
    upgrade(local);
    upgrade(local);
    expect(local.getItem('dorandoran_participant_id')).toBe('current');
    expect(local.length).toBe(1);
  });

  it('다른 서비스의 설정과 모르는 필드를 건드리지 않는다', () => {
    const local = storage({ another_theme: 'light', previous_participant_id: 'student', previous_unrelated: 'keep' });
    upgrade(local);
    expect(local.getItem('another_theme')).toBe('light');
    expect(local.getItem('previous_unrelated')).toBe('keep');
    expect(local.getItem('dorandoran_unrelated')).toBeNull();
  });

  it('새 키 쓰기가 실패하면 이전 데이터를 삭제하지 않는다', () => {
    const local = storage({ previous_participant_id: 'student' });
    local.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => upgrade(local)).not.toThrow();
    expect(local.getItem('previous_participant_id')).toBe('student');
  });

  it('localStorage 접근이 막혀도 sessionStorage 이동과 앱 시작이 가능하다', () => {
    const sessionStorage = storage({ previous_admin: '{"uid":"teacher"}' });
    const window = { sessionStorage };
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
    expect(() => runInNewContext(script, { window })).not.toThrow();
    expect(sessionStorage.getItem('dorandoran_admin')).toBe('{"uid":"teacher"}');
  });
});
