import { motion } from 'framer-motion';
import { Check, ChartColumn } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

/** 짧은 보기 2~4개는 결과를 서로 비교할 수 있는 발표 차트로 표현한다. */
export default function PollColumns({ options, counts, total, revealed, correctValue, resultsHidden = false, loading = false }) {
  const max = Math.max(1, ...counts);
  return <div className="poll-columns" data-empty={total === 0}>
    <div className="poll-columns-plot" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((option, index) => {
        const correct = revealed && correctValue === option;
        const percent = total ? Math.round(counts[index] / total * 100) : 0;
        return <div key={option} className="poll-column" data-correct={correct}>
          <div className="poll-column-bar-area">
            {total > 0 && <>
              <div className="poll-column-track" aria-hidden="true" />
              <motion.div className="poll-column-value" initial={false} animate={{ bottom: `calc(${counts[index] / max * 100}% - ${counts[index] / max * 64}px + 12px)` }} transition={{ type: 'spring', stiffness: 150, damping: 25 }}><span><AnimatedNumber value={percent} />%</span><span>{counts[index]}명</span></motion.div>
            </>}
            <motion.div initial={false} animate={{ scaleY: counts[index] / max }} transition={{ type: 'spring', stiffness: 150, damping: 25 }}
              className="poll-column-bar" style={{ background: correct ? '#4338ca' : ['#818cf8','#a5b4fc','#c4b5fd','#64748b'][index] }} />
          </div>
          <p className="poll-column-label"><span className="poll-option-heading"><span className="poll-option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></span>{correct && <span className="poll-correct-chip"><Check size={18} />정답</span>}</p>
        </div>;
      })}
    </div>
    {total === 0 && <div className="poll-waiting-note"><ChartColumn size={28} /><p>{loading ? '응답 집계를 불러오고 있어요' : revealed ? '제출된 응답이 없어요' : '답을 선택해주세요'}<span>{loading ? '잠시 후 결과가 표시됩니다' : revealed ? '다음 활동에서 함께 참여해주세요' : resultsHidden ? '실시간 집계를 준비하고 있어요' : '선택하면 차트가 함께 자라요'}</span></p></div>}
  </div>;
}
