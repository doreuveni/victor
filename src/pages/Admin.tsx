import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatRelative } from '@/lib/time';
import { CheckCircleIcon } from '@/components/icons';
import type { AdminReport } from '@/features/admin/types';

export default function Admin() {
  const [reports, setReports] = useState<AdminReport[] | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setReports(null);
    const { data } = await supabase.rpc('admin_reports');
    setReports((data ?? []) as AdminReport[]);
  }

  async function setStatus(id: string, status: 'resolved' | 'dismissed') {
    setReports((prev) => (prev ?? []).filter((r) => r.id !== id));
    await supabase.from('reports').update({ status }).eq('id', id);
  }

  async function hideRecipe(recipeId: string) {
    await supabase.from('recipes').update({ is_public: false }).eq('id', recipeId);
    setReports((prev) =>
      (prev ?? []).map((r) => (r.recipe_id === recipeId ? { ...r, recipe_is_public: false } : r)),
    );
  }

  async function deleteComment(commentId: string, reportId: string) {
    await supabase.from('comments').delete().eq('id', commentId);
    setStatus(reportId, 'resolved');
  }

  async function setBanned(userId: string, banned: boolean) {
    await supabase.rpc('admin_set_banned', { p_user_id: userId, p_banned: banned });
    setReports((prev) =>
      (prev ?? []).map((r) => (r.target_id === userId ? { ...r, profile_is_banned: banned } : r)),
    );
  }

  return (
    <div className="px-4 py-4">
      <h1 className="mb-4 text-xl font-bold text-stone-900">תור דיווחים</h1>

      {reports === null ? (
        <p className="py-8 text-center text-sm text-stone-500 animate-pulse">טוען…</p>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center text-sm text-stone-500">
          <p className="flex justify-center text-success-500">
            <CheckCircleIcon size={28} />
          </p>
          <p className="mt-2">אין דיווחים פתוחים.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-stone-200 p-3">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>
                  דווח ע״י <span className="ltr">@{r.reporter_username}</span> · {formatRelative(r.created_at)}
                </span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5">{typeLabel(r.target_type)}</span>
              </div>

              {r.reason && <p className="mt-1.5 text-sm text-stone-700">{r.reason}</p>}

              <div className="mt-2 rounded-xl bg-stone-50 p-2.5 text-sm">
                {r.target_type === 'recipe' && (
                  <p>
                    <Link to={`/r/${r.recipe_id}`} className="font-medium text-brand-700 hover:underline">
                      {r.recipe_title ?? '(מתכון נמחק)'}
                    </Link>{' '}
                    מאת <span className="ltr">@{r.recipe_author_username}</span>
                    {r.recipe_is_public === false && (
                      <span className="ms-2 text-xs text-stone-500">(כבר מוסתר)</span>
                    )}
                  </p>
                )}
                {r.target_type === 'comment' && (
                  <p>
                    <span className="ltr">@{r.comment_author_username}</span> כתב:{' '}
                    <span className="text-stone-600">"{r.comment_body ?? '(תגובה נמחקה)'}"</span>{' '}
                    {r.comment_recipe_id && (
                      <Link to={`/r/${r.comment_recipe_id}`} className="text-brand-700 hover:underline">
                        (צפה במתכון)
                      </Link>
                    )}
                  </p>
                )}
                {r.target_type === 'profile' && (
                  <p>
                    <Link to={`/u/${r.profile_username}`} className="font-medium text-brand-700 hover:underline">
                      <span className="ltr">@{r.profile_username}</span>
                    </Link>
                    {r.profile_is_banned && <span className="ms-2 text-xs text-danger-500">(מושעה)</span>}
                  </p>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {r.target_type === 'recipe' && r.recipe_id && r.recipe_is_public !== false && (
                  <ActionBtn onClick={() => hideRecipe(r.recipe_id!)}>הסתר מתכון</ActionBtn>
                )}
                {r.target_type === 'comment' && r.target_id && (
                  <ActionBtn onClick={() => deleteComment(r.target_id, r.id)}>מחק תגובה</ActionBtn>
                )}
                {r.target_type === 'profile' && r.target_id && (
                  <ActionBtn onClick={() => setBanned(r.target_id, !r.profile_is_banned)}>
                    {r.profile_is_banned ? 'בטל השעיה' : 'השעה משתמש'}
                  </ActionBtn>
                )}
                <ActionBtn onClick={() => setStatus(r.id, 'dismissed')} muted>
                  דחה דיווח
                </ActionBtn>
                <ActionBtn onClick={() => setStatus(r.id, 'resolved')} muted>
                  סמן כטופל
                </ActionBtn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function typeLabel(t: AdminReport['target_type']) {
  return { recipe: 'מתכון', comment: 'תגובה', profile: 'משתמש' }[t];
}

function ActionBtn({
  onClick,
  muted,
  children,
}: {
  onClick: () => void;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        muted ? 'bg-stone-100 text-stone-600 hover:bg-stone-200' : 'bg-danger-500 text-white hover:bg-danger-600'
      }`}
    >
      {children}
    </button>
  );
}
