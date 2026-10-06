import { memo } from 'react';
import { motion } from 'framer-motion';

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
        ? `mx-auto max-w-full rounded-xl object-contain ${text ? 'max-h-[20dvh] lg:max-h-[40dvh]' : 'max-h-[24dvh] lg:max-h-[52dvh]'}`
        : 'mx-auto max-h-[45dvh] w-auto max-w-full rounded-lg object-contain'}
    />
  );
  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
      data-answer-explanation
      className={presenter
        ? 'w-full min-w-0 lg:flex-[2] space-y-3'
        : 'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 space-y-3'}
    >
      <figcaption className={presenter
        ? 'text-lg font-medium text-slate-500 dark:text-slate-400 text-center'
        : 'text-xs font-medium text-slate-500 dark:text-slate-400'}>
        정답 해설
      </figcaption>
      {text && (
        <p className={presenter
          ? 'text-2xl lg:text-[28px] leading-snug font-medium text-slate-900 dark:text-slate-100 text-center whitespace-pre-line break-keep'
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
