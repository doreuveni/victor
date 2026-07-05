import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import Avatar from '@/components/Avatar';
import SmartImage from '@/components/SmartImage';
import { LogoMark, BackIcon, CommentIcon, CheckIcon, EmptyBowlIcon, MoreIcon } from '@/components/icons';
import LikeButton from '@/features/social/LikeButton';
import SaveButton from '@/features/collections/SaveButton';
import CommentsSection from '@/features/comments/CommentsSection';
import ReportButton from '@/features/reports/ReportButton';
import RecipeOwnerMenu from './RecipeOwnerMenu';

// Shape of the nested fetch. Client is untyped, so we describe it locally.
interface FullRecipe {
  id: string;
  author_id: string;
  title: string;
  caption: string | null;
  prep_min: number | null;
  cook_min: number | null;
  servings: number | null;
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  author: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  category: { name_he: string } | null;
  recipe_stats: { like_count: number; comment_count: number } | null;
  recipe_photos: { url: string; position: number }[];
  ingredient_sections: {
    id: string;
    name: string | null;
    position: number;
    ingredient_items: { id: string; text: string; position: number }[];
  }[];
  instruction_steps: { number: number; text: string; photo_url: string | null }[];
}

const SELECT = `
  id, author_id, title, caption, prep_min, cook_min, servings, cover_url, is_public, created_at,
  author:profiles!recipes_author_id_fkey ( username, display_name, avatar_url ),
  category:categories ( name_he ),
  recipe_stats ( like_count, comment_count ),
  recipe_photos ( url, position ),
  ingredient_sections ( id, name, position, ingredient_items ( id, text, position ) ),
  instruction_steps ( number, text, photo_url )
`;

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [recipe, setRecipe] = useState<FullRecipe | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [commentCount, setCommentCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setState('loading');
    supabase
      .from('recipes')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setState('notfound');
          return;
        }
        const full = data as unknown as FullRecipe;
        setRecipe(full);
        setCommentCount(full.recipe_stats?.comment_count ?? 0);
        setState('ready');
      });
  }, [id]);

  function toggle(itemId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  if (state === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-brand-500 animate-pulse">
        <LogoMark size={32} />
      </div>
    );
  }

  if (state === 'notfound' || !recipe) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="flex justify-center text-stone-300">
          <EmptyBowlIcon size={40} />
        </p>
        <p className="mt-3 text-stone-600">המתכון לא נמצא או שאינו זמין לך.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm font-medium text-brand-600">
          חזרה לגלה
        </button>
      </div>
    );
  }

  const isOwner = session?.user.id === recipe.author_id;
  const gallery = [...recipe.recipe_photos].sort((a, b) => a.position - b.position);
  const sections = [...recipe.ingredient_sections].sort((a, b) => a.position - b.position);
  const steps = [...recipe.instruction_steps].sort((a, b) => a.number - b.number);
  const times = [
    recipe.prep_min && `הכנה ${recipe.prep_min} דק'`,
    recipe.cook_min && `בישול ${recipe.cook_min} דק'`,
    recipe.servings && `${recipe.servings} מנות`,
  ].filter(Boolean) as string[];
  const author = recipe.author;
  const stats = recipe.recipe_stats;

  const floatingBtn =
    'flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white';

  return (
    <div className="pb-6">
      {/* Cover, with back/report floating on top of it — no second sticky bar. */}
      {recipe.cover_url ? (
        <div className="relative">
          <SmartImage src={recipe.cover_url} alt="" className="aspect-[4/3] w-full object-cover" fallbackClassName="aspect-[4/3] w-full" />
          <button onClick={() => navigate(-1)} className={`absolute start-3 top-3 ${floatingBtn}`} aria-label="חזור">
            <BackIcon />
          </button>
          {isOwner ? (
            <button onClick={() => setMenuOpen(true)} className={`absolute end-3 top-3 ${floatingBtn}`} aria-label="עוד אפשרויות">
              <MoreIcon size={18} />
            </button>
          ) : (
            <ReportButton
              targetType="recipe"
              targetId={recipe.id}
              className={`absolute end-3 top-3 !h-10 !w-10 bg-white/85 text-stone-600 shadow-sm backdrop-blur hover:bg-white hover:text-danger-500`}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2 py-2">
          <button onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100" aria-label="חזור">
            <BackIcon />
          </button>
          <div className="flex-1" />
          {isOwner ? (
            <button onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100" aria-label="עוד אפשרויות">
              <MoreIcon size={18} />
            </button>
          ) : (
            <ReportButton targetType="recipe" targetId={recipe.id} />
          )}
        </div>
      )}

      {menuOpen && <RecipeOwnerMenu recipeId={recipe.id} onClose={() => setMenuOpen(false)} />}

      <div className="space-y-5 px-4 pt-4">
        {/* Title + private badge */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{recipe.title}</h1>
            {isOwner && !recipe.is_public && (
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-600">פרטי</span>
            )}
          </div>
          {recipe.category && (
            <span className="mt-1 inline-block rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700">
              {recipe.category.name_he}
            </span>
          )}
          {recipe.caption && <p className="mt-2 text-stone-700">{recipe.caption}</p>}
          {times.length > 0 && (
            <p className="mt-2 text-sm text-stone-500">
              <span className="ltr">{times.join(' · ')}</span>
            </p>
          )}
        </div>

        {/* Author */}
        {author && (
          <Link to={`/u/${author.username}`} className="flex items-center gap-3">
            <Avatar url={author.avatar_url} name={author.display_name || author.username} size={40} />
            <div className="leading-tight">
              <p className="text-sm font-semibold">{author.display_name || author.username}</p>
              <p className="text-xs text-stone-400">
                <span className="ltr">@{author.username}</span>
              </p>
            </div>
          </Link>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-5 border-y border-stone-100 py-3 text-stone-500">
          <LikeButton recipeId={recipe.id} initialCount={stats?.like_count ?? 0} />
          <span className="flex items-center gap-1.5 text-sm">
            <CommentIcon /> {commentCount}
          </span>
          <div className="flex-1" />
          <SaveButton recipeId={recipe.id} />
        </div>

        {/* Extra gallery */}
        {gallery.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {gallery.map((p) => (
              <SmartImage key={p.url} src={p.url} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" fallbackClassName="h-28 w-28 shrink-0 rounded-xl" />
            ))}
          </div>
        )}

        {/* Ingredients — tap to check off (cooking mode) */}
        <section>
          <h2 className="mb-2 text-lg font-bold">מרכיבים</h2>
          {sections.map((sec) => {
            const items = [...sec.ingredient_items].sort((a, b) => a.position - b.position);
            if (items.length === 0) return null;
            return (
              <div key={sec.id} className="mb-3">
                {sec.name && <h3 className="mb-1 text-sm font-semibold text-stone-700">{sec.name}</h3>}
                <ul className="space-y-1">
                  {items.map((it) => {
                    const on = checked.has(it.id);
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => toggle(it.id)}
                          className="flex min-h-11 w-full items-start gap-2.5 rounded-lg py-2 text-start"
                        >
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              on ? 'border-brand-500 bg-brand-500 text-white' : 'border-stone-300'
                            }`}
                          >
                            {on && <CheckIcon />}
                          </span>
                          <span className={on ? 'text-stone-400 line-through' : 'text-stone-800'}>{it.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        {/* Steps */}
        {steps.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold">אופן ההכנה</h2>
            <ol className="space-y-4">
              {steps.map((s) => (
                <li key={s.number} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {s.number}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <p className="text-stone-800">{s.text}</p>
                    {s.photo_url && (
                      <SmartImage src={s.photo_url} alt="" className="mt-2 max-h-56 rounded-xl object-cover" fallbackClassName="mt-2 h-40 w-full rounded-xl" />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <CommentsSection
          recipeId={recipe.id}
          recipeOwnerId={recipe.author_id}
          onCountChange={(delta) => setCommentCount((c) => c + delta)}
        />
      </div>
    </div>
  );
}
