import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';

interface Props {
  targetId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
  className?: string;
}

// Optimistic follow/unfollow. RLS on `follows` already scopes writes to the
// caller's own follower_id, so no extra client-side check is needed there.
export default function FollowButton({ targetId, initialFollowing, onChange, className }: Props) {
  const { session } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!session || busy) return;
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    setBusy(true);
    const { error } = next
      ? await supabase.from('follows').insert({ follower_id: session.user.id, followee_id: targetId })
      : await supabase.from('follows').delete().match({ follower_id: session.user.id, followee_id: targetId });
    setBusy(false);
    if (error) {
      // Roll back on failure.
      setFollowing(!next);
      onChange?.(!next);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`min-h-11 rounded-xl px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
        following
          ? 'border border-stone-300 text-stone-700 hover:bg-stone-50'
          : 'bg-brand-500 text-white hover:bg-brand-600'
      } ${className ?? ''}`}
    >
      {following ? 'עוקב' : 'עקוב'}
    </button>
  );
}
