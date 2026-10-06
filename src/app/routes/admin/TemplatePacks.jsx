import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Download, Check, Snowflake, ClipboardList, Users, Code, Lightbulb, Package } from 'lucide-react';
import { TEMPLATE_PACKS } from '@/lib/template-packs';
import { QUESTION_TYPES } from '@/lib/question-types';
import Button from '@/components/ui/Button';

const ICON_MAP = { Snowflake, ClipboardList, Users, Code, Lightbulb };

function PackQuestionPreview({ question, index }) {
  const qType = QUESTION_TYPES.find((t) => t.value === question.type);
  const Icon = qType?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
      className="flex items-start gap-3 py-2.5"
    >
      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {Icon && <Icon size={11} className="text-slate-400 shrink-0" />}
          <span className="text-[11px] font-medium text-slate-400">{qType?.label}</span>
        </div>
        <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{question.title}</p>
      </div>
    </motion.div>
  );
}

function PackCard({ pack, onImport, imported, index }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const typeLabels = [...new Set(pack.questions.map((q) => q.type))];
  const PackIcon = ICON_MAP[pack.icon] || Package;

  useEffect(() => {
    if (expanded && cardRef.current) {
      setTimeout(() => cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
    }
  }, [expanded]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, type: 'spring', stiffness: 300, damping: 25 }}
      ref={cardRef}
      className={`rounded-xl border overflow-hidden transition-all duration-200 ${
        expanded
          ? 'border-slate-300 dark:border-slate-600 shadow-md'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-slate-700 transition-colors duration-150 bg-white dark:bg-slate-800"
      >
        <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <PackIcon size={18} className="text-slate-500 dark:text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 text-sm font-semibold">{pack.name}</p>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{pack.questions.length}개 질문 · {typeLabels.length}가지 유형</p>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="text-slate-300 dark:text-slate-500 shrink-0"
        >
          <ChevronRight size={16} />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400 py-2 leading-relaxed">{pack.description}</p>
              <div className="space-y-0.5">
                {pack.questions.map((q, i) => (
                  <PackQuestionPreview key={i} question={q} index={i} />
                ))}
              </div>
              <div className="pt-3">
                {imported ? (
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-slate-400 font-medium"
                  >
                    <Check size={16} />
                    추가 완료
                  </motion.div>
                ) : (
                  <Button
                    onClick={(e) => { e.stopPropagation(); onImport(pack); }}
                    variant="primary"
                    size="sm"
                    className="w-full"
                  >
                    <Download size={14} />
                    보관함에 추가
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TemplatePacks({ onImportPack }) {
  const [imported, setImported] = useState(new Set());
  function handleImport(pack) {
    onImportPack(pack.questions);
    setImported((prev) => new Set(prev).add(pack.id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        <Package size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">템플릿 팩</h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">바로 사용할 수 있는 질문 모음</span>
      </div>
      <div className="space-y-2.5">
        {TEMPLATE_PACKS.map((pack, i) => (
          <PackCard key={pack.id} pack={pack} onImport={handleImport} imported={imported.has(pack.id)} index={i} />
        ))}
      </div>
    </div>
  );
}
