import type { DraftData } from './types';

interface Props {
  data: DraftData;
}

// Read-only render approximating the recipe detail view (built fully in step 5).
export default function StepPreview({ data }: Props) {
  const times = [
    data.prep_min && `הכנה ${data.prep_min} דק'`,
    data.cook_min && `בישול ${data.cook_min} דק'`,
    data.servings && `${data.servings} מנות`,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {data.cover_url && (
        <img src={data.cover_url} alt="" className="h-56 w-full rounded-2xl object-cover" />
      )}

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-stone-900">{data.title || 'ללא כותרת'}</h1>
          {!data.is_public && (
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">פרטי</span>
          )}
        </div>
        {data.caption && <p className="mt-1 text-stone-600">{data.caption}</p>}
        {times.length > 0 && (
          <p className="mt-2 text-sm text-stone-500">
            <span className="ltr">{times.join(' · ')}</span>
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-1 font-bold text-stone-900">מרכיבים</h2>
        {data.sections.map((s, i) => {
          const items = s.items.filter((x) => x.trim());
          if (items.length === 0) return null;
          return (
            <div key={i} className="mb-2">
              {s.name && <h3 className="text-sm font-semibold text-stone-700">{s.name}</h3>}
              <ul className="list-disc space-y-0.5 ps-6 text-stone-800">
                {items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-1 font-bold text-stone-900">אופן ההכנה</h2>
        <ol className="space-y-3">
          {data.steps
            .filter((s) => s.text.trim())
            .map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-stone-800">{s.text}</p>
                  {s.photo_url && <img src={s.photo_url} alt="" className="mt-2 w-32 rounded-lg object-cover" />}
                </div>
              </li>
            ))}
        </ol>
      </section>
    </div>
  );
}
