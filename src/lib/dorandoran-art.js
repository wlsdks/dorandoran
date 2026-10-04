const MOODS = new Set(['happy', 'waiting', 'thinking', 'focus', 'sad', 'calm']);

function face(mood, x, y, friend) {
  const eye = mood === 'happy' ? `M${x-14} ${y}q4-5 8 0m10 0q4-5 8 0`
    : mood === 'calm' ? `M${x-14} ${y}q4 4 8 0m10 0q4 4 8 0` : null;
  const eyes = eye ? `<path d="${eye}" stroke="#334155" stroke-width="3" stroke-linecap="round"/>`
    : `<ellipse cx="${x-10}" cy="${y}" rx="3" ry="4" fill="#334155"/><ellipse cx="${x+8}" cy="${y}" rx="3" ry="4" fill="#334155"/>`;
  const mouth = mood === 'thinking' ? `<circle cx="${x}" cy="${y+14}" r="2.5" fill="#334155"/>`
    : `<path d="M${x-5} ${y+12}${mood==='focus' ? 'h10' : `q5 ${mood==='sad' ? -5 : 6} 10 0`}" stroke="#334155" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<g class="dd-eyes dd-eyes-${friend}">${eyes}</g>${mouth}<ellipse cx="${x-20}" cy="${y+11}" rx="6" ry="3" fill="#818cf8" opacity=".18"/><ellipse cx="${x+19}" cy="${y+11}" rx="6" ry="3" fill="#818cf8" opacity=".18"/>`;
}

/** 기존 벡터 캐릭터의 단일 원본. 입력은 표정 열거값뿐이며 사용자 HTML을 포함하지 않는다. */
export function createDoranDoranSvg({ mood = 'happy', animated = false } = {}) {
  const expression = MOODS.has(mood) ? mood : 'happy';
  const styles = animated ? `<style>
.dd-friend{transform-box:fill-box;transform-origin:50% 100%;animation:dd-breathe 4.8s ease-in-out infinite}
.dd-two{animation-duration:5.4s;animation-delay:-1.8s}
.dd-eyes{transform-box:fill-box;transform-origin:center;animation:dd-blink 6.8s linear infinite}
.dd-eyes-two{animation-delay:-2.3s}
@keyframes dd-breathe{0%,100%{transform:scaleY(1) rotate(0)}50%{transform:scaleY(1.018) rotate(.65deg)}}
@keyframes dd-blink{0%,43%,47%,100%{transform:scaleY(1)}45%{transform:scaleY(.12)}}
@media(prefers-reduced-motion:reduce){.dd-friend,.dd-eyes{animation:none}}
</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" aria-hidden="true">${styles}
<ellipse cx="119" cy="153" rx="75" ry="6" fill="#64748b" opacity=".12"/>
<g class="dd-friend dd-two"><ellipse cx="165" cy="148" rx="7" ry="3.5" fill="#64748b"/><ellipse cx="184" cy="148" rx="7" ry="3.5" fill="#64748b"/>
<path d="M164 61c-26 0-42 17-42 41s16 38 42 38h20l15 10q5 3 4-3l-2-16c12-8 19-20 19-34 0-23-18-36-43-36h-13Z" fill="#f8fafc" stroke="#64748b" stroke-width="2.5" stroke-linejoin="round"/>${face(expression,173,98,'two')}</g>
<g class="dd-friend dd-one"><ellipse cx="78" cy="148" rx="8" ry="3.5" fill="#64748b"/><ellipse cx="101" cy="148" rx="8" ry="3.5" fill="#64748b"/>
<path d="M81 32c-34 0-56 21-56 51 0 22 11 38 31 46l-3 16q-1 6 4 3l21-14h19c33 0 52-20 52-49 0-32-21-53-53-53H81Z" fill="#a5b4fc" stroke="#64748b" stroke-width="2.5" stroke-linejoin="round"/>${face(expression,90,80,'one')}
<path d="M138 114q7 10 15 4" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/></g></svg>`;
}
