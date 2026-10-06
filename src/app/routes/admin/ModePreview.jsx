import { motion } from 'framer-motion';
import { stepForward } from '@/lib/motion';
import { ArrowLeft, IdCard, Gift, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import ScratchCard from '@/features/games/components/ScratchCard';

/**
 * 모드 미리보기.
 *
 * 설명을 읽는 것보다 한 번 만져보는 쪽이 빠르다. 그래서 실제 화면을 그대로 띄우되,
 * **세션에 붙이지 않은 채로** 보여준다. ScratchCard는 sessionId가 없으면 전자칠판 동기화를
 * 발행하지 않고(useGameMirror), onResult를 넘기지 않으면 당첨 기록도 남기지 않는다.
 * 따라서 여기서 아무리 긁어도 실제 데이터는 한 줄도 쌓이지 않는다.
 */

/** 미리보기용 가짜 명단. 실제 참여자와 헷갈리지 않게 흔한 예시 이름을 쓴다. */
const SAMPLE_ROSTER = [{
  id: 'preview_1',
  nickname: '홍길동',
  employeeId: '20260001'
}, {
  id: 'preview_2',
  nickname: '김철수',
  employeeId: '20260002'
}, {
  id: 'preview_3',
  nickname: '이영희',
  employeeId: '20260003'
}, {
  id: 'preview_4',
  nickname: '박민수',
  employeeId: '20260004'
}, {
  id: 'preview_5',
  nickname: '최지우',
  employeeId: '20260005'
}, {
  id: 'preview_6',
  nickname: '강한나',
  employeeId: '20260006'
}];
const CONTENT = {
  drawOnly: {
    icon: Gift,
    title: '추첨 전용 모드',
    summary: '참여자 입장 없이, 강사가 명단을 직접 넣어 추첨만 진행합니다.',
    points: ['학생이 QR로 들어오지 않습니다. 링크를 열어도 입장이 막힙니다.', '명단은 이름과 사번을 직접 입력하거나 엑셀에서 붙여넣습니다.', '추첨 결과는 전자칠판에 그대로 비칩니다.']
  },
  requireEmployeeId: {
    icon: IdCard,
    title: '기업 행사모드',
    summary: '학생이 입장할 때 사번(직원번호)을 반드시 받습니다.',
    points: ['입장 화면에 사번 입력칸이 필수로 뜹니다.', '강사 화면 참여자 목록에 이름과 사번이 함께 보입니다.', '내보내기 파일에 사번 열이 포함됩니다.']
  }
};

/** 학생 입장 화면 목업. 실제 입장 흐름을 태우지 않고 모양만 보여준다. */
function JoinMockup() {
  return <div className="mx-auto w-56 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
      <p className="text-center text-xs text-slate-400">학생 입장 화면</p>
      <div className="space-y-2">
        <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-2.5 text-sm text-slate-400">
          닉네임
        </div>
        <div className="rounded-lg bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-100 px-3 py-2.5 text-sm text-slate-400 flex items-center justify-between">
          사번 입력 (필수)
          <IdCard size={14} className="text-slate-500" />
        </div>
      </div>
      <div className="rounded-lg bg-slate-900 dark:bg-slate-100 py-2.5 text-center text-sm font-medium text-white dark:text-slate-900">
        참여하기
      </div>
    </div>;
}
export default function ModePreview({
  mode,
  onBack
}) {
  const content = CONTENT[mode];
  if (!content) return null;
  const Icon = content.icon;
  return <motion.div key="preview" {...stepForward} className="space-y-5">
      <div className="flex items-start gap-3">
        <Icon size={20} className="text-slate-500 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{content.title}</h2>
          <p className="text-slate-400 text-sm mt-1">{content.summary}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {content.points.map(point => <li key={point} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="text-slate-300 dark:text-slate-600">·</span>
            {point}
          </li>)}
      </ul>

      <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-4">
        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-3">
          <EyeOff size={12} />
          미리보기입니다. 여기서 무엇을 해도 저장되지 않습니다.
        </p>
        {mode === 'drawOnly' ? <div className="flex justify-center [&_h3]:hidden">
            <ScratchCard participants={SAMPLE_ROSTER} />
          </div> : <JoinMockup />}
      </div>

      <Button onClick={onBack} variant="secondary" size="md" className="w-full">
        <ArrowLeft size={16} />
        돌아가기
      </Button>
    </motion.div>;
}
