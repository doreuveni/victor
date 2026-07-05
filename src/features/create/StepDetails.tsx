import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';
import type { DraftData } from './types';

interface Props {
  data: DraftData;
  update: (patch: Partial<DraftData>) => void;
}

export default function StepDetails({ data, update }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('position')
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  const numOrNull = (v: string) => (v === '' ? null : Math.max(0, parseInt(v, 10) || 0));

  return (
    <div className="space-y-5">
      <Field label="כותרת *">
        <input
          value={data.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="שם המתכון"
          className={inputCls}
        />
      </Field>

      <Field label="תיאור">
        <textarea
          value={data.caption}
          onChange={(e) => update({ caption: e.target.value })}
          placeholder="כמה מילים על המנה…"
          rows={3}
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="הכנה (דק')">
          <input inputMode="numeric" value={data.prep_min ?? ''} onChange={(e) => update({ prep_min: numOrNull(e.target.value) })} className={inputCls} />
        </Field>
        <Field label="בישול (דק')">
          <input inputMode="numeric" value={data.cook_min ?? ''} onChange={(e) => update({ cook_min: numOrNull(e.target.value) })} className={inputCls} />
        </Field>
        <Field label="מנות">
          <input inputMode="numeric" value={data.servings ?? ''} onChange={(e) => update({ servings: numOrNull(e.target.value) })} className={inputCls} />
        </Field>
      </div>

      <Field label="קטגוריה">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = data.category_id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ category_id: active ? null : c.id })}
                className={`min-h-11 rounded-full px-3 py-1.5 text-sm ${
                  active ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {c.name_he}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="נראות">
        <div className="flex gap-2">
          <Toggle active={data.is_public} onClick={() => update({ is_public: true })}>ציבורי</Toggle>
          <Toggle active={!data.is_public} onClick={() => update({ is_public: false })}>פרטי</Toggle>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          {data.is_public ? 'כולם יוכלו לראות את המתכון.' : 'רק אתה תראה את המתכון.'}
        </p>
      </Field>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-xl border py-2 text-sm ${
        active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-stone-300 text-stone-600'
      }`}
    >
      {children}
    </button>
  );
}
