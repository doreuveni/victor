import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import FollowButton from '@/features/profile/FollowButton';
import { useAuth } from '@/context/AuthProvider';
import type { SearchProfile } from './types';

export default function PersonRow({ person }: { person: SearchProfile }) {
  const { profile } = useAuth();
  const isSelf = profile?.id === person.id;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link to={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar url={person.avatar_url} name={person.display_name || person.username} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{person.display_name || person.username}</p>
          <p className="truncate text-xs text-stone-500">
            <span className="ltr">@{person.username}</span> · {person.followers_count} עוקבים
          </p>
        </div>
      </Link>
      {!isSelf && <FollowButton targetId={person.id} initialFollowing={person.is_following} />}
    </div>
  );
}
