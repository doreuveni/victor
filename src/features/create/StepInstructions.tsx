import type { DraftData, InstructionStep } from './types';
import { XIcon } from '@/components/icons';
import PhotoButton from '@/components/PhotoButton';

interface Props {
  data: DraftData;
  update: (patch: Partial<DraftData>) => void;
}

// Numbered steps, each with an optional compact inline photo.
export default function StepInstructions({ data, update }: Props) {
  const setSteps = (steps: InstructionStep[]) => update({ steps });
  const patchStep = (i: number, patch: Partial<InstructionStep>) =>
    setSteps(data.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  // No empty steps: can't add a new one until the last has text.
  const canAdd = data.steps.length === 0 || data.steps[data.steps.length - 1].text.trim().length > 0;

  return (
    <div className="space-y-4">
      {data.steps.map((step, i) => (
        <div key={i} className="flex gap-2">
          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-start gap-2">
              <textarea
                value={step.text}
                onChange={(e) => patchStep(i, { text: e.target.value })}
                placeholder="תיאור השלב…"
                rows={2}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {!step.photo_url && (
                <PhotoButton compact onUploaded={(url) => patchStep(i, { photo_url: url })} />
              )}
              {data.steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSteps(data.steps.filter((_, j) => j !== i))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-300 hover:text-danger-500"
                  aria-label="מחק שלב"
                >
                  <XIcon size={15} />
                </button>
              )}
            </div>
            {step.photo_url && (
              <div className="relative mt-2 w-28">
                <img src={step.photo_url} alt="" className="h-24 w-28 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => patchStep(i, { photo_url: null })}
                  aria-label="הסר תמונה"
                  className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <XIcon size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        disabled={!canAdd}
        onClick={() => setSteps([...data.steps, { text: '', photo_url: null }])}
        className="min-h-11 w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + הוסף שלב
      </button>
      {!canAdd && <p className="text-center text-xs text-stone-500">מלא את השלב הנוכחי לפני הוספת שלב חדש.</p>}
    </div>
  );
}
