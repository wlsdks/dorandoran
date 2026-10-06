import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { TYPE_LABELS } from '@/lib/question-types';
import ImageSlidePresenter from '@/features/visualization/components/ImageSlidePresenter';

/**
 * QuestionPreview — 강사용 문항 미리보기 모달.
 * 전자칠판/프레젠터 화면처럼 문항을 순서대로 보여줌.
 */
export default function QuestionPreview({ questionList, open, onClose }) {
  const [current, setCurrent] = useState(0);
  const [previewSlide, setPreviewSlide] = useState(0);

  if (!open || questionList.length === 0) return null;

  const total = questionList.length;
  const [, question] = questionList[Math.min(current, total - 1)];
  const hasPrev = current > 0;
  const hasNext = current < total - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-slate-900 flex flex-col"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0">
          <span className="text-white/50 text-sm font-medium">
            미리보기 {current + 1} / {total}
          </span>
          <button onClick={onClose} className="text-white/50 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center px-8 py-4 overflow-y-auto">
          <div className="w-full max-w-3xl text-center space-y-6">
            {/* Type badge */}
            <Badge variant="primary">{TYPE_LABELS[question.type] || question.type}</Badge>

            {/* Title */}
            {!question.hideTitle && (
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                {question.title}
              </h2>
            )}

            {/* Image */}
            {question.imageUrl && (
              <img src={question.imageUrl} alt={question.title || '질문 이미지'} className="max-h-64 rounded-xl object-cover mx-auto" />
            )}

            {/* Image slide */}
            {question.type === 'imageSlide' && question.slideImages?.length > 0 && (
              <ImageSlidePresenter
                images={question.slideImages}
                currentSlide={previewSlide}
                onSlideChange={setPreviewSlide}
              />
            )}

            {/* Type-specific info */}
            {question.options && (
              <div className="space-y-2 max-w-md mx-auto">
                {question.options.map((opt, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    question.correctAnswer === opt
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 text-slate-300'
                  }`}>
                    <span className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {question.optionImages?.[i] && <img src={question.optionImages[i]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                    <span className="text-sm font-medium">{opt}</span>
                    {question.correctAnswer === opt && (
                      <span className="ml-auto text-xs text-emerald-400 font-semibold">정답</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Mystery box / Hint quiz info */}
            {question.correctAnswer && !question.options && (
              <div className="px-6 py-4 rounded-xl bg-slate-800 border border-slate-700 max-w-md mx-auto">
                <p className="text-xs text-slate-500 mb-1">정답</p>
                <p className="text-xl font-bold text-white">{question.correctAnswer}</p>
              </div>
            )}

            {/* Hints */}
            {question.hints?.length > 0 && (
              <div className="space-y-2 max-w-md mx-auto">
                <p className="text-xs text-slate-500 uppercase tracking-wider">힌트 {question.hints.length}개</p>
                {question.hints.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300">
                    <span className="w-5 h-5 rounded bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                    {h}
                  </div>
                ))}
              </div>
            )}

            {/* Winners */}
            {question.winners?.length > 0 && (
              <div className="max-w-md mx-auto">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">당첨자 {question.winners.length}명</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {question.winners.map((w, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-sm font-medium">
                      {i + 1}등 {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-center gap-4 px-6 py-4 shrink-0">
          <button onClick={() => { setCurrent(c => c - 1); setPreviewSlide(0); }} disabled={!hasPrev}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex gap-1.5">
            {questionList.map((_, i) => (
              <button key={i} onClick={() => { setCurrent(i); setPreviewSlide(0); }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => { setCurrent(c => c + 1); setPreviewSlide(0); }} disabled={!hasNext}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
