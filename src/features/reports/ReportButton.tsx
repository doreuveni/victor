import { useState } from 'react';
import { FlagIcon } from '@/components/icons';
import ReportModal from './ReportModal';
import type { ReportTarget } from './types';

interface Props {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
}

export default function ReportButton({ targetType, targetId, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="דווח"
        className={`flex h-11 w-11 items-center justify-center ${className ?? 'text-stone-300 hover:text-danger-500'}`}
      >
        <FlagIcon />
      </button>
      {open && <ReportModal targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}
