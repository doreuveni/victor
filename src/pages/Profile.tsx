import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useFeed, type PageFetcher } from '@/features/feed/useFeed';
import FeedList from '@/features/feed/FeedList';
import FollowButton from '@/features/profile/FollowButton';
import BoardsGrid from '@/features/collections/BoardsGrid';
import ReportButton from '@/features/reports/ReportButton';
import Avatar from '@/components/Avatar';
import { LogoMark, EmptyBowlIcon } from '@/components/icons';
import { SQUARE_ASPECT } from '@/lib/constants';
import type { FeedCard } from '@/features/feed/types';
import type { ProfileHeader } from '@/features/profile/types';

type Tab = 'recipes' | 'boards';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileHeader | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [tab, setTab] = useState<Tab>('recipes');

  useEffect(() => setTab('recipes'), [username]);

  useEffect(() => {
    if (!username) return;
    setState('loading');
    supabase
      .rpc('get_profile', { p_username: username })
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setState('notfound');
          return;
        }
        setProfile(data as ProfileHeader);
        setState('ready');
      });
  }, [username]);

  const fetcher: PageFetcher = useCallback(
    async (cursor, limit) => {
      if (!username) return [];
      const { data, error } = await supabase.rpc('profile_recipes', {
        p_username: username,
        p_cursor_created: cursor?.created ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as FeedCard[];
    },
    [username],
  );

  const feed = useFeed(fetcher, [username]);

  if (state === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-brand-500 animate-pulse">
        <LogoMark size={32} />
      </div>
    );
  }

  if (state === 'notfound' || !profile) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="flex justify-center text-stone-300">
          <EmptyBowlIcon size={40} />
        </p>
        <p className="mt-3 text-stone-600">המשתמש לא נמצא.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-sm font-medium text-brand-600">
          חזרה לגלה
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      {/* Avatar + stats row — Instagram-style: avatar beside the numbers, not stacked. */}
      <div className="flex items-center gap-4">
        <Avatar url={profile.avatar_url} name={profile.display_name || profile.username} size={78} />
        <div className="flex flex-1 justify-around">
          <Stat value={profile.recipe_count} label="מתכונים" />
          <Stat value={profile.followers_count} label="עוקבים" />
          <Stat value={profile.following_count} label="עוקב אחרי" />
        </div>
      </div>

      <div className="mt-3">
        <h1 className="truncate font-bold text-stone-900">{profile.display_name || profile.username}</h1>
        <p className="text-sm text-stone-500">
          <span className="ltr">@{profile.username}</span>
        </p>
        {profile.bio && <p className="mt-1.5 whitespace-pre-wrap text-sm text-stone-700">{profile.bio}</p>}
      </div>

      <div className="mt-3 flex gap-2">
        {profile.is_self ? (
          <Link
            to="/me/edit"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            ערוך פרופיל
          </Link>
        ) : (
          <>
            <FollowButton
              targetId={profile.id}
              initialFollowing={profile.is_following}
              onChange={(f) =>
                setProfile((p) => (p ? { ...p, following_count: p.following_count, followers_count: p.followers_count + (f ? 1 : -1) } : p))
              }
              className="flex-1"
            />
            <ReportButton
              targetType="profile"
              targetId={profile.id}
              className="rounded-xl border border-stone-300 text-stone-500 hover:bg-stone-50 hover:text-danger-500"
            />
          </>
        )}
      </div>

      <div className="mt-5 flex gap-2 border-b border-stone-100">
        <TabButton active={tab === 'recipes'} onClick={() => setTab('recipes')}>
          מתכונים
        </TabButton>
        <TabButton active={tab === 'boards'} onClick={() => setTab('boards')}>
          אוספים
        </TabButton>
      </div>

      <div className="mt-4">
        {tab === 'recipes' ? (
          <FeedList
            items={feed.items}
            status={feed.status}
            hasMore={feed.hasMore}
            loadingMore={feed.loadingMore}
            loadMore={feed.loadMore}
            view="grid"
            gridAspect={SQUARE_ASPECT}
            empty={profile.is_self ? 'עדיין לא פרסמת מתכון.' : 'עדיין אין מתכונים.'}
          />
        ) : (
          <BoardsGrid ownerId={profile.id} isSelf={profile.is_self} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 px-3 pb-2.5 text-sm font-medium ${
        active ? 'border-b-2 border-brand-600 text-brand-600' : 'text-stone-500'
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}
