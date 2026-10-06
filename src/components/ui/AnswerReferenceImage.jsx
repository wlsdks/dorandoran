import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * AnswerReferenceImage — 정답 공개 뒤 보여주는 참고 이미지.
 * 공개 여부는 호출부가 판단한다. 학생 화면에서는 탭하면 원본 크기로 연다.
 */
export default memo(function AnswerReferenceImage({ src, presenter = false }) {
  if (!src) return null;
  const image = (
    <img
      src={src}
      alt="정답 참고 이미지"
      decoding="async"
      className={presenter
        ? 'mx-auto max-h-[24dvh] lg:max-h-[52dvh] max-w-full rounded-xl object-contain'
        : 'mx-auto max-h-[50dvh] w-full rounded-lg object-contain'}
    />
  );
  return (
    <motion.figure
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
      data-answer-image
      className={presenter
        ? 'w-full min-w-0 lg:flex-[2] text-center space-y-2'
        : 'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-3 space-y-2'}
    >
      <figcaption className={presenter
        ? 'text-lg font-medium text-slate-500 dark:text-slate-400'
        : 'text-xs font-medium text-slate-500 dark:text-slate-400 px-1'}>
        정답 참고 이미지
      </figcaption>
      {presenter ? image : (
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label="정답 참고 이미지 크게 보기" className="block">
          {image}
        </a>
      )}
    </motion.figure>
  );
});
