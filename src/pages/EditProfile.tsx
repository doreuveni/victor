import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { uploadAvatar, uploadAvatarBlob } from '@/lib/storage';
import { SQUARE_ASPECT } from '@/lib/constants';
import Avatar from '@/components/Avatar';
import PhotoButton from '@/components/PhotoButton';
import { BackIcon } from '@/components/icons';

const BIO_MAX = 150;

export default function EditProfile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  async function save() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl })
      .eq('id', profile!.id);
    setSaving(false);
    if (err) {
      setError('השמירה נכשלה. נסה שוב.');
      return;
    }
    await refreshProfile();
    navigate(`/u/${profile!.username}`);
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-5 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-stone-100" aria-label="חזור">
          <BackIcon />
        </button>
        <h1 className="text-lg font-bold text-stone-900">עריכת פרופיל</h1>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Avatar url={avatarUrl} name={displayName || profile.username} size={88} />
        <PhotoButton
          label="החלף תמונת פרופיל"
          aspect={SQUARE_ASPECT}
          upload={uploadAvatar}
          uploadBlob={uploadAvatarBlob}
          onUploaded={setAvatarUrl}
        />
      </div>

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">שם לתצוגה</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="השם שיוצג לאחרים"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">ביו</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder="כמה מילים על עצמך…"
            rows={3}
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          <span className="mt-1 block text-end text-xs text-stone-400">
            {bio.length}/{BIO_MAX}
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">שם משתמש</span>
          <div className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-stone-400">
            <span className="ltr">@{profile.username}</span>
          </div>
          <span className="mt-1 block text-xs text-stone-400">שם המשתמש קבוע ולא ניתן לשינוי.</span>
        </label>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="min-h-11 w-full rounded-xl bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          {saving ? 'שומר…' : 'שמור'}
        </button>

        <button onClick={signOut} className="min-h-11 w-full rounded-xl border border-stone-300 py-3 text-sm text-stone-600 hover:bg-stone-50">
          התנתק
        </button>
      </div>
    </div>
  );
}
