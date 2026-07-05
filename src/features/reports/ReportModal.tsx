import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useScrollLock } from '@/lib/useScrollLock';
import { CheckCircleIcon } from '@/components/icons';
import { REPORT_REASONS, type ReportTarget } from './types';

interface Props {
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
}

// Anyone signed in can report anything they can see; RLS scopes the insert
// to reporter_id = auth.uid() and only admins can ever read the queue.
export default function ReportModal({ targetType, targetId, onClose }: Props) {
  const { session } = useAuth();
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  useScrollLock();

  async function submit() {
    if (!session || state === 'sending') return;
    setState('sending');
    const { error } = await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: targetType,
      target_id: targetId,
      reason: note.trim() ? `${reason}: ${note.trim()}` : reason,
    });
    setState(error ? 'error' : 'sent');
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="pb-safe w-full max-w-lg rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />

        {state === 'sent' ? (
          <div className="py-6 text-center">
            <p className="flex justify-center text-success-500">
              <CheckCircleIcon size={32} />
            </p>
            <p className="mt-2 text-sm text-stone-600">הדיווח נשלח. תודה שעזרת לשמור על הקהילה.</p>
            <button onClick={onClose} className="mt-4 min-h-11 text-sm font-medium text-brand-600">
              סגור
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-3 font-bold">דיווח</h2>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm ${
                    reason === r ? 'bg-brand-50 text-brand-700' : 'hover:bg-stone-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      reason === r ? 'border-brand-500' : 'border-stone-300'
                    }`}
                  >
                    {reason === r && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                  </span>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="פרטים נוספים (לא חובה)…"
              rows={2}
              className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            {state === 'error' && <p className="mt-2 text-xs text-danger-600">שליחת הדיווח נכשלה. נסה שוב.</p>}
            <button
              onClick={submit}
              disabled={state === 'sending'}
              className="mt-3 min-h-11 w-full rounded-xl bg-danger-500 py-2.5 text-sm font-medium text-white transition hover:bg-danger-600 disabled:opacity-40"
            >
              {state === 'sending' ? 'שולח…' : 'שלח דיווח'}
            </button>
            <button onClick={onClose} className="mt-2 min-h-11 w-full rounded-xl bg-stone-100 py-2.5 text-sm text-stone-700 hover:bg-stone-200">
              ביטול
            </button>
          </>
        )}
      </div>
    </div>
  );
}
