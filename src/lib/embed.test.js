import { describe, it, expect } from 'vitest';
import { safeEmbedUrl, embedDisplayUrl, embedRejectMessage, EMBED_REJECT, EMBED_SANDBOX } from './embed';

const SELF = 'https://jinan-6c884.web.app';
const check = (raw) => safeEmbedUrl(raw, { selfOrigin: SELF });

describe('safeEmbedUrl', () => {
  it('http/https 주소를 통과시킨다', () => {
    expect(check('https://example.com/docs').url).toBe('https://example.com/docs');
    expect(check('http://example.com').url).toBe('http://example.com/');
  });

  it('스킴을 빼먹으면 https로 읽는다', () => {
    expect(check('example.com/page').url).toBe('https://example.com/page');
  });

  it('위험한 스킴을 막는다', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'file:///etc/passwd', 'vbscript:msgbox']) {
      const result = check(bad);
      expect(result.url, bad).toBeNull();
      expect(result.reason, bad).toBe(EMBED_REJECT.SCHEME);
    }
  });

  it('앱 자신의 주소는 막는다 — 같은 출처를 sandbox에 넣으면 앱 내부에 접근할 수 있다', () => {
    expect(check(`${SELF}/admin`).reason).toBe(EMBED_REJECT.SELF);
    expect(check(SELF).reason).toBe(EMBED_REJECT.SELF);
  });

  it('다른 출처면 호스트가 비슷해도 통과한다', () => {
    expect(check('https://jinan-6c884.web.app.evil.com').url).toBeTruthy();
  });

  it('빈 값과 형식 오류를 구분해 알린다', () => {
    expect(check('').reason).toBe(EMBED_REJECT.EMPTY);
    expect(check('   ').reason).toBe(EMBED_REJECT.EMPTY);
    expect(check('https://').reason).toBe(EMBED_REJECT.MALFORMED);
  });

  it('거절 사유마다 사람이 읽을 안내가 있다', () => {
    for (const reason of Object.values(EMBED_REJECT)) {
      expect(embedRejectMessage(reason)).toBeTruthy();
    }
  });
});

describe('EMBED_SANDBOX', () => {
  it('임베드된 페이지가 우리 창을 다른 곳으로 보내지 못하게 한다', () => {
    expect(EMBED_SANDBOX).not.toContain('allow-top-navigation');
  });

  it('스크립트와 폼은 허용한다 — 대부분의 사이트가 그래야 동작한다', () => {
    expect(EMBED_SANDBOX).toContain('allow-scripts');
    expect(EMBED_SANDBOX).toContain('allow-forms');
  });
});

describe('embedDisplayUrl', () => {
  it('프로토콜을 떼고 보여준다', () => {
    expect(embedDisplayUrl('https://example.com/docs?a=1')).toBe('example.com/docs?a=1');
    expect(embedDisplayUrl('https://example.com/')).toBe('example.com');
  });

  it('이상한 값이 와도 그대로 돌려준다', () => {
    expect(embedDisplayUrl('not a url')).toBe('not a url');
  });
});
