import { memo } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';

/**
 * AnswerExplanation — 정답 공개 뒤 보여주는 해설 글과 참고 이미지(둘 다 선택).
 * 공개 여부는 호출부가 판단한다. 학생 화면에서는 이미지를 탭하면 원본 크기로 연다.
 */
export default memo(function AnswerExplanation({ text, imageSrc, presenter = false }) {
  if (!text && !imageSrc) return null;
  const image = imageSrc && (
    <img
      src={imageSrc}
      alt="정답 참고 이미지"
      decoding="async"
      className={presenter
        ? `mx-auto max-w-full rounded-xl object-contain ${text ? 'max-h-[20dvh] lg:max-h-[30dvh]' : 'max-h-[24dvh] lg:max-h-[46dvh]'}`
        : 'mx-auto max-h-[45dvh] w-auto max-w-full rounded-lg object-contain'}
    />
  );
  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.default, delay: 0.15 }}
      data-answer-explanation
      className={presenter
        ? 'w-full min-w-0 lg:flex-[2] space-y-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 p-5 lg:p-6'
        : 'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-3'}
    >
      <figcaption className={presenter
        ? 'text-base font-semibold text-slate-500 dark:text-slate-400'
        : 'text-xs font-medium text-slate-500 dark:text-slate-400'}>
        정답 해설
      </figcaption>
      {text && (
        <p className={presenter
          ? 'text-[clamp(1.125rem,1.35vw,1.75rem)] leading-relaxed font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line break-keep'
          : 'text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-line break-keep'}>
          {text}
        </p>
      )}
      {image && (presenter ? image : (
        <a href={imageSrc} target="_blank" rel="noopener noreferrer" aria-label="정답 참고 이미지 크게 보기" className="block">
          {image}
        </a>
      ))}
    </motion.figure>
  );
});
