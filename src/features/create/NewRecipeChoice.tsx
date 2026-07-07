import { useNavigate } from 'react-router-dom';
import { EditIcon, ScanIcon } from '@/components/icons';

// Entry point for /create — asks scratch-vs-import before landing in the
// wizard, so the "+" nav action keeps meaning "create a recipe" either way.
//
// AI import is built (see ./aiImport/) but not wired up here yet — the
// ai-recipe-import edge function isn't deployed with a live ANTHROPIC_API_KEY
// yet. Shown as a disabled "coming soon" card until that's live.
export default function NewRecipeChoice() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl text-stone-900">מתכון חדש</h1>

      <button
        onClick={() => navigate('/create/new')}
        className="flex items-center gap-4 rounded-2xl border border-stone-200 p-4 text-start hover:border-brand-300 hover:bg-brand-50/40"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
          <EditIcon size={20} />
        </span>
        <span>
          <span className="block font-medium text-stone-900">מתחילים מאפס</span>
          <span className="block text-sm text-stone-500">מלאו את המתכון שלב אחר שלב</span>
        </span>
      </button>

      <div
        aria-disabled
        className="flex items-center gap-4 rounded-2xl border border-stone-200 p-4 text-start opacity-50"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-600">
          <ScanIcon size={20} />
        </span>
        <span>
          <span className="flex items-center gap-2">
            <span className="font-medium text-stone-900">ייבוא מתמונה</span>
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium text-stone-600">בקרוב</span>
          </span>
          <span className="block text-sm text-stone-500">צלמו או העלו צילום מסך של מתכון, ונמלא לכם את הפרטים</span>
        </span>
      </div>
    </div>
  );
}
