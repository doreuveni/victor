import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { LogoMark, CheckIcon, EmptyBowlIcon } from '@/components/icons';
import { emptyDraft, STEP_LABELS, type DraftData } from './types';
import StepPhotos from './StepPhotos';
import StepDetails from './StepDetails';
import StepIngredients from './StepIngredients';
import StepInstructions from './StepInstructions';
import StepPreview from './StepPreview';

type SaveState = 'idle' | 'saving' | 'saved';

const EDIT_SELECT = `
  author_id, title, caption, category_id, prep_min, cook_min, servings, cover_url, is_public,
  recipe_photos ( url, position ),
  ingredient_sections ( name, position, ingredient_items ( text, position ) ),
  instruction_steps ( number, text, photo_url )
`;

interface EditRecipeRow {
  author_id: string;
  title: string;
  caption: string | null;
  category_id: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  cover_url: string | null;
  is_public: boolean;
  recipe_photos: { url: string; position: number }[];
  ingredient_sections: {
    name: string | null;
    position: number;
    ingredient_items: { text: string; position: number }[];
  }[];
  instruction_steps: { number: number; text: string; photo_url: string | null }[];
}

function recipeToDraft(r: EditRecipeRow): DraftData {
  const sections = [...r.ingredient_sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      name: s.name ?? '',
      items: [...s.ingredient_items].sort((a, b) => a.position - b.position).map((i) => i.text),
    }));
  const steps = [...r.instruction_steps]
    .sort((a, b) => a.number - b.number)
    .map((s) => ({ text: s.text, photo_url: s.photo_url }));
  const photos = [...r.recipe_photos].sort((a, b) => a.position - b.position).map((p) => p.url);
  return {
    title: r.title,
    caption: r.caption ?? '',
    category_id: r.category_id,
    prep_min: r.prep_min,
    cook_min: r.cook_min,
    servings: r.servings,
    is_public: r.is_public,
    cover_url: r.cover_url,
    photos,
    sections: sections.length > 0 ? sections : [{ name: '', items: [''] }],
    steps: steps.length > 0 ? steps : [{ text: '', photo_url: null }],
  };
}

export default function CreateRecipe() {
  // Present -> editing an existing published recipe. Absent -> the normal
  // new-recipe draft flow.
  const { id: editId } = useParams<{ id?: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session!.user.id;

  const [data, setData] = useState<DraftData>(emptyDraft);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // Edit mode: load the existing recipe into the same DraftData shape. No
  // autosave-to-draft-table here — editing an existing recipe shouldn't
  // touch whatever unrelated new-recipe draft the user has in progress.
  useEffect(() => {
    if (!editId) return;
    supabase
      .from('recipes')
      .select(EDIT_SELECT)
      .eq('id', editId)
      .maybeSingle()
      .then(({ data: row, error: err }) => {
        const full = row as unknown as EditRecipeRow | null;
        if (err || !full || full.author_id !== userId) {
          setNotFound(true);
          setReady(true);
          return;
        }
        setData(recipeToDraft(full));
        setReady(true);
      });
  }, [editId, userId]);

  // Resume an existing draft (create mode only) — survives refresh / other device.
  useEffect(() => {
    if (editId) return;
    supabase
      .from('recipe_drafts')
      .select('id, data')
      .eq('owner_id', userId)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) {
          setDraftId(row.id as string);
          setData({ ...emptyDraft(), ...(row.data as DraftData) });
        }
        setReady(true);
      });
  }, [userId, editId]);

  // Persist the current draft; returns the draft id. (Create mode only.)
  const saveNow = useCallback(async (): Promise<string | null> => {
    setSaveState('saving');
    const { data: row, error: err } = await supabase
      .from('recipe_drafts')
      .upsert({ owner_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' })
      .select('id')
      .single();
    if (err) {
      setSaveState('idle');
      return null;
    }
    setDraftId(row.id as string);
    setSaveState('saved');
    return row.id as string;
  }, [userId, data]);

  // Debounced autosave on every change — create mode only.
  useEffect(() => {
    if (editId || !ready || !dirty.current) return;
    setSaveState('saving');
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void saveNow(), 800);
    return () => clearTimeout(debounce.current);
  }, [data, ready, editId, saveNow]);

  const update = useCallback((patch: Partial<DraftData>) => {
    dirty.current = true;
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const hasIngredient = data.sections.some((s) => s.items.some((i) => i.trim()));
  const canSave = data.title.trim().length > 0 && hasIngredient;

  async function save() {
    if (!canSave) {
      setError(editId ? 'צריך לפחות כותרת ומרכיב אחד כדי לשמור.' : 'צריך לפחות כותרת ומרכיב אחד כדי לפרסם.');
      return;
    }
    setPublishing(true);
    setError(null);

    if (editId) {
      const { error: rpcErr } = await supabase.rpc('update_recipe', { p_recipe_id: editId, p_data: data });
      if (rpcErr) {
        setError('השמירה נכשלה. נסה שוב.');
        setPublishing(false);
        return;
      }
      navigate(`/r/${editId}`);
      return;
    }

    clearTimeout(debounce.current);
    const id = await saveNow();
    if (!id) {
      setError('שמירת הטיוטה נכשלה. נסה שוב.');
      setPublishing(false);
      return;
    }
    const { data: newId, error: rpcErr } = await supabase.rpc('publish_draft', { p_draft_id: id });
    if (rpcErr) {
      setError('הפרסום נכשל. נסה שוב.');
      setPublishing(false);
      return;
    }
    navigate(`/r/${newId}`);
  }

  async function cancelOrDiscard() {
    if (editId) {
      navigate(`/r/${editId}`);
      return;
    }
    if (!confirm('למחוק את הטיוטה? הפעולה אינה הפיכה.')) return;
    if (draftId) await supabase.from('recipe_drafts').delete().eq('id', draftId);
    navigate('/');
  }

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center text-brand-500 animate-pulse">
        <LogoMark size={32} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="flex justify-center text-stone-300">
          <EmptyBowlIcon size={40} />
        </p>
        <p className="mt-3 text-stone-600">המתכון לא נמצא או שאינו שלך.</p>
        <button onClick={() => navigate('/me')} className="mt-4 text-sm font-medium text-brand-600">
          לפרופיל שלי
        </button>
      </div>
    );
  }

  const isLast = step === STEP_LABELS.length - 1;

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col px-4 py-4">
      {/* Progress header */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-bold text-stone-900">{STEP_LABELS[step]}</h1>
          {!editId && <SaveBadge state={saveState} />}
        </div>
        <div className="flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className="flex min-h-11 flex-1 items-center"
              aria-label={label}
            >
              <span className={`h-1.5 w-full rounded-full ${i <= step ? 'bg-brand-500' : 'bg-stone-200'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1">
        {step === 0 && <StepPhotos data={data} update={update} />}
        {step === 1 && <StepDetails data={data} update={update} />}
        {step === 2 && <StepIngredients data={data} update={update} />}
        {step === 3 && <StepInstructions data={data} update={update} />}
        {step === 4 && <StepPreview data={data} />}
      </div>

      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}

      {/* Footer nav */}
      <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3">
        <button onClick={cancelOrDiscard} className="min-h-11 text-sm text-stone-500 hover:text-danger-500">
          {editId ? 'ביטול' : 'מחק'}
        </button>
        <div className="flex-1" />
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            חזור
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="min-h-11 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            הבא
          </button>
        ) : (
          <button
            onClick={save}
            disabled={!canSave || publishing}
            className="min-h-11 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            {publishing ? (editId ? 'שומר…' : 'מפרסם…') : editId ? 'שמור שינויים' : 'פרסם'}
          </button>
        )}
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span className="flex items-center gap-1 text-xs text-stone-500">
      {state === 'saving' ? 'שומר…' : (
        <>
          <CheckIcon size={11} /> נשמר
        </>
      )}
    </span>
  );
}
