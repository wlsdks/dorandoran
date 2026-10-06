import { motion } from 'framer-motion';
import { Check, ChartColumn } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import { grow, popIn } from '@/lib/motion';

/** 짧은 보기 2~4개는 결과를 서로 비교할 수 있는 발표 차트로 표현한다. */
export default function PollColumns({ options, counts, total, revealed, correctValue, resultsHidden = false, loading = false }) {
  // 막대 높이는 1등 답 기준으로 키운다(최소 40% 기준). 4지선다에서 33%가 영역의 1/3만 차던 것을 키우되,
  // 막대끼리의 비율과 표시하는 퍼센트는 그대로다.
  const scale = Math.max(0.4, ...counts.map(count => (total ? count / total : 0)));
  return <div className="poll-columns" data-empty={total === 0}>
    <div className="poll-columns-plot" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((option, index) => {
        const correct = revealed && correctValue === option;
        const dimmed = revealed && correctValue != null && !correct;
        const percent = total ? Math.round(counts[index] / total * 100) : 0;
        const proportion = total ? counts[index] / total / scale : 0;
        return <div key={option} className={`poll-column ${correct ? 'answer-glow' : dimmed ? 'answer-dim' : ''}`} data-correct={correct}>
          <div className="poll-column-bar-area">
            {total > 0 && <>
              {/* 값 라벨은 bottom을 직접 두고 layout="position"으로 옮긴다 — 매 득표마다 레이아웃 속성을 애니메이션하지 않는다 */}
              <motion.div className="poll-column-value" layout="position" transition={{ layout: grow }} style={{ bottom: `calc(${proportion * 100}% - ${proportion * 64}px + 12px)` }}><span><AnimatedNumber value={percent} />%</span><span><AnimatedNumber value={counts[index]} />명</span></motion.div>
            </>}
            <motion.div initial={false} animate={{ scaleY: proportion }} transition={grow}
              className="poll-column-bar" style={{ background: correct ? 'var(--color-indigo-500)' : revealed && correctValue ? 'var(--color-slate-600)' : 'var(--color-indigo-400)' }} />
          </div>
          <p className="poll-column-label"><span className="poll-option-heading"><span className="poll-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></span>{correct && <motion.span {...popIn} transition={{ ...popIn.transition, delay: 0.18 }} className="poll-correct-chip"><Check size={18} />정답</motion.span>}</p>
        </div>;
      })}
    </div>
    {total === 0 && <div className="poll-waiting-note"><ChartColumn size={28} /><p>{loading ? '응답 집계를 불러오고 있어요' : revealed ? '제출된 응답이 없어요' : '답을 선택해주세요'}<span>{loading ? '잠시 후 결과가 표시됩니다' : revealed ? '다음 활동에서 함께 참여해주세요' : resultsHidden ? '실시간 집계를 준비하고 있어요' : '선택하면 차트가 함께 자라요'}</span></p></div>}
  </div>;
}
