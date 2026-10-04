import { motion } from 'framer-motion';
import { Check, Smartphone } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';

/** 짧은 보기 2~4개는 결과를 서로 비교할 수 있는 발표 차트로 표현한다. */
export default function PollColumns({ options, counts, total, revealed, correctValue }) {
  const max = Math.max(1, ...counts);
  return <div className="poll-columns">
    <div className="poll-columns-plot" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((option, index) => {
        const correct = revealed && correctValue === option;
        const percent = total ? Math.round(counts[index] / total * 100) : 0;
        return <div key={option} className="poll-column" data-correct={correct}>
          <div className="poll-column-bar-area">
            <motion.div className="poll-column-value" initial={false} animate={{ bottom: `calc(${counts[index] / max * 100}% - ${counts[index] / max * 64}px + 12px)` }} transition={{ type: 'spring', stiffness: 150, damping: 25 }}><AnimatedNumber value={percent} />%<span>{counts[index]}명</span></motion.div>
            <motion.div initial={false} animate={{ scaleY: counts[index] / max }} transition={{ type: 'spring', stiffness: 150, damping: 25 }}
              className="poll-column-bar" style={{ background: correct ? '#4338ca' : ['#818cf8','#a5b4fc','#c4b5fd','#64748b'][index] }} />
          </div>
          <p className="poll-column-label"><span>{option}</span>{correct && <span className="poll-correct-chip"><Check size={18} />정답</span>}</p>
        </div>;
      })}
    </div>
    {total === 0 && <div className="poll-waiting-note"><Smartphone size={28} /><p>휴대폰에서 답을 골라주세요<span>응답하면 차트가 함께 자라요</span></p></div>}
  </div>;
}
