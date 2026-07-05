import type { DraftData, IngredientSection } from './types';
import { TrashIcon, XIcon } from '@/components/icons';

interface Props {
  data: DraftData;
  update: (patch: Partial<DraftData>) => void;
}

// Ingredients grouped into named sections ("לרוטב", "לבצק"), each a list of
// free-text lines.
export default function StepIngredients({ data, update }: Props) {
  const setSections = (sections: IngredientSection[]) => update({ sections });

  const patchSection = (i: number, patch: Partial<IngredientSection>) =>
    setSections(data.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-5">
      {data.sections.map((section, si) => (
        <div key={si} className="rounded-2xl border border-stone-200 p-3">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={section.name}
              onChange={(e) => patchSection(si, { name: e.target.value })}
              placeholder={data.sections.length > 1 ? 'שם הקבוצה (למשל: לרוטב)' : 'שם הקבוצה (אופציונלי)'}
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-brand-400"
            />
            {data.sections.length > 1 && (
              <button
                type="button"
                onClick={() => setSections(data.sections.filter((_, j) => j !== si))}
                className="flex h-11 w-11 items-center justify-center text-stone-400 hover:text-danger-500"
                aria-label="מחק קבוצה"
              >
                <TrashIcon size={16} />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {section.items.map((item, ii) => (
              <div key={ii} className="flex items-center gap-1">
                <span className="text-stone-300">•</span>
                <input
                  value={item}
                  onChange={(e) =>
                    patchSection(si, {
                      items: section.items.map((it, j) => (j === ii ? e.target.value : it)),
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      patchSection(si, { items: [...section.items, ''] });
                    }
                  }}
                  placeholder="למשל: 2 כוסות קמח"
                  className="min-h-11 flex-1 border-b border-stone-200 py-1.5 outline-none focus:border-brand-400"
                />
                {section.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => patchSection(si, { items: section.items.filter((_, j) => j !== ii) })}
                    className="flex h-11 w-11 items-center justify-center text-stone-300 hover:text-danger-500"
                    aria-label="מחק שורה"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => patchSection(si, { items: [...section.items, ''] })}
            className="mt-2 min-h-11 text-sm font-medium text-brand-600"
          >
            + הוסף מרכיב
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setSections([...data.sections, { name: '', items: [''] }])}
        className="min-h-11 w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm text-stone-600 hover:bg-stone-50"
      >
        + הוסף קבוצת מרכיבים
      </button>
    </div>
  );
}
