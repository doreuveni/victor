import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useScrollLock } from '@/lib/useScrollLock';
import { CheckIcon } from '@/components/icons';

interface Board {
  id: string;
  name: string;
  is_default: boolean;
}

interface Props {
  recipeId: string;
  onClose: () => void;
  onSavedChange: (saved: boolean) => void;
}

// Bottom-sheet style modal: check/uncheck the caller's own boards to add or
// remove this recipe, plus create a new board inline. RLS on collections /
// collection_items already scopes everything to owner_id = auth.uid().
export default function SaveModal({ recipeId, onClose, onSavedChange }: Props) {
  const { session } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  useScrollLock();

  useEffect(() => {
    if (!session) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!session) return;
    setLoading(true);
    const [{ data: myBoards }, { data: inBoards }] = await Promise.all([
      supabase
        .from('collections')
        .select('id, name, is_default')
        .eq('owner_id', session.user.id)
        .order('is_default', { ascending: false })
        .order('created_at'),
      supabase.from('collection_items').select('collection_id').eq('recipe_id', recipeId),
    ]);
    setBoards((myBoards ?? []) as Board[]);
    setChecked(new Set((inBoards ?? []).map((r) => r.collection_id as string)));
    setLoading(false);
  }

  async function toggleBoard(boardId: string) {
    if (!session) return;
    const inBoard = checked.has(boardId);
    const next = new Set(checked);
    inBoard ? next.delete(boardId) : next.add(boardId);
    setChecked(next);
    onSavedChange(next.size > 0);
    if (inBoard) {
      await supabase.from('collection_items').delete().match({ collection_id: boardId, recipe_id: recipeId });
    } else {
      await supabase.from('collection_items').insert({ collection_id: boardId, recipe_id: recipeId });
    }
  }

  async function createBoard() {
    const name = newName.trim();
    if (!name || !session || creating) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('collections')
      .insert({ owner_id: session.user.id, name, is_public: true })
      .select('id, name, is_default')
      .single();
    if (!error && data) {
      setBoards((prev) => [...prev, data as Board]);
      setNewName('');
      await toggleBoard(data.id as string);
    }
    setCreating(false);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="pb-safe max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />
        <h2 className="mb-3 font-bold">שמור לאוסף</h2>

        {loading ? (
          <p className="py-6 text-center text-sm text-stone-500 animate-pulse">טוען…</p>
        ) : (
          <div className="space-y-1">
            {boards.map((b) => {
              const on = checked.has(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => toggleBoard(b.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start hover:bg-stone-50"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      on ? 'border-brand-500 bg-brand-500 text-white' : 'border-stone-300'
                    }`}
                  >
                    {on && <CheckIcon />}
                  </span>
                  <span className="flex-1">{b.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createBoard()}
            placeholder="אוסף חדש…"
            className="min-h-11 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={createBoard}
            disabled={!newName.trim() || creating}
            className="min-h-11 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            צור
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 min-h-11 w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-200"
        >
          סיום
        </button>
      </div>
    </div>
  );
}
