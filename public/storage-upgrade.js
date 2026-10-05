// 앱 전용 출처의 이전 저장 스키마를 새 네임스페이스로 옮긴다.
// 브랜드 문자열 대신 이 앱의 저장 필드로 인식하며, 알려진 데이터만 이동한다.
(function () {
  const namespace = 'dorandoran_';
  const fields = /^(?:participant_id|nickname|joined_sessions|theme(?:_prev)?|admin|staff_nickname|draw_display|preview_last_ts|notes_.+|autoOpened_.+|(?:chat|qa|dm)_seen_.+)$/;
  const anchors = /^(?:participant_id|joined_sessions|admin|staff_nickname|draw_display|preview_last_ts|theme_prev|notes_.+|autoOpened_.+|(?:chat|qa|dm)_seen_.+)$/;

  function upgrade(storage) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    const previousNamespaces = new Set();
    for (const key of keys) {
      const match = /^([a-z][a-z0-9]*)_(.+)$/.exec(key || '');
      if (match && anchors.test(match[2])) previousNamespaces.add(match[1]);
    }
    for (const key of keys) {
      if (!key || key.startsWith(namespace)) continue;
      const match = /^([a-z][a-z0-9]*)_(.+)$/.exec(key);
      if (!match || !previousNamespaces.has(match[1]) || !fields.test(match[2])) continue;
      try {
        const target = namespace + match[2];
        const value = storage.getItem(key);
        if (value === null) continue;
        if (storage.getItem(target) === null) storage.setItem(target, value);
        storage.removeItem(key);
      } catch {
        // 쓰기에 실패하면 원래 값을 보존한다. 접근이 제한된 저장소는 건너뛴다.
      }
    }
  }

  try { upgrade(window.localStorage); } catch { /* 저장소 접근 불가 */ }
  try { upgrade(window.sessionStorage); } catch { /* 저장소 접근 불가 */ }
})();
