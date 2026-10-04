import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
async function fixture(active, state = 'running') {
  const oscillator = () => ({ frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const gain = () => ({ connect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } });
  const ctx = { state, currentTime: 0, destination: {}, resume: vi.fn().mockResolvedValue(), createOscillator: vi.fn(oscillator), createGain: vi.fn(gain) };
  const constructor = vi.fn(function () { return ctx; });
  vi.stubGlobal('window', { AudioContext: constructor });
  vi.stubGlobal('navigator', { userActivation: { hasBeenActive: active } });
  vi.stubGlobal('localStorage', { getItem: vi.fn() });
  return { ctx, constructor, sound: await import('./chime') };
}
it('조작 전 실시간 알림은 오디오 컨텍스트와 노드를 만들지 않는다', async () => {
  const { constructor, sound } = await fixture(false);
  await sound.playChime(); await sound.playCorrect(); await sound.playIncorrect();
  expect(constructor).not.toHaveBeenCalled();
});
it('재생이 막힌 상태에서는 과거 알림을 노드로 쌓지 않는다', async () => {
  const { ctx, sound } = await fixture(true, 'suspended');
  await sound.playChime();
  expect(ctx.resume).not.toHaveBeenCalled(); expect(ctx.createOscillator).not.toHaveBeenCalled();
});
it('사용자 조작 후 허용된 알림은 두 음을 재생한다', async () => {
  const { ctx, sound } = await fixture(true);
  await sound.playChime(); expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
});
it('음소거 상태는 정답/오답 소리를 준비하지 않는다', async () => {
  const { constructor, sound } = await fixture(true);
  localStorage.getItem.mockReturnValue('true'); await sound.playCorrect(); await sound.playIncorrect();
  expect(constructor).not.toHaveBeenCalled();
});

it('사용자 조작으로 준비한 컨텍스트만 재개하고 그 뒤 알림을 재생한다', async () => {
  const { ctx, sound } = await fixture(true, 'suspended');
  sound.unlockNotificationAudio(); expect(ctx.resume).toHaveBeenCalledOnce();
  ctx.state = 'running'; await sound.playChime(); expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
});
