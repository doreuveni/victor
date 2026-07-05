import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { CheckIcon } from '@/components/icons';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function Onboarding() {
  const { session, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(
    profile?.display_name ?? (session?.user.user_metadata.full_name as string) ?? '',
  );
  const [availability, setAvailability] = useState<Availability>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const normalized = username.trim().toLowerCase();
  const formatValid = useMemo(() => USERNAME_RE.test(normalized), [normalized]);

  // Debounced availability check.
  useEffect(() => {
    setError(null);
    if (normalized.length === 0) {
      setAvailability('idle');
      return;
    }
    if (!formatValid) {
      setAvailability('invalid');
      return;
    }
    setAvailability('checking');
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', normalized)
        .maybeSingle();
      setAvailability(data ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [normalized, formatValid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user || !formatValid || availability === 'taken') return;
    setSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: normalized, display_name: displayName.trim() || null })
      .eq('id', session.user.id);

    if (updateError) {
      // 23505 = unique_violation: someone claimed it between check and submit.
      if (updateError.code === '23505') {
        setAvailability('taken');
        setError('השם הזה נתפס הרגע. נסה שם אחר.');
      } else {
        setError('משהו השתבש. נסה שוב.');
      }
      setSubmitting(false);
      return;
    }

    await refreshProfile(); // App gate will now route into the app.
  }

  const canSubmit = formatValid && availability === 'available' && !submitting;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-stone-900">בחר שם משתמש</h1>
        <p className="mt-1 text-sm text-stone-500">
          זה יהיה השם הקבוע שלך באפליקציה — לא ניתן לשנות אותו מאוחר יותר.
        </p>

        <label className="mt-6 block text-sm font-medium text-stone-700">שם משתמש</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
          <span className="text-stone-400">@</span>
          <input
            dir="ltr"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="min-h-11 flex-1 bg-transparent py-3 text-start outline-none"
          />
          <StatusDot state={availability} />
        </div>

        <FieldHint state={availability} value={normalized} />

        <label className="mt-5 block text-sm font-medium text-stone-700">שם לתצוגה</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="השם שיוצג לאחרים"
          className="min-h-11 mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />

        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 min-h-11 w-full rounded-xl bg-brand-500 px-5 py-3 font-medium text-white transition enabled:hover:bg-brand-600 disabled:opacity-40"
        >
          {submitting ? 'שומר…' : 'המשך'}
        </button>
      </form>
    </div>
  );
}

function StatusDot({ state }: { state: Availability }) {
  const color =
    state === 'available'
      ? 'bg-success-500'
      : state === 'taken' || state === 'invalid'
        ? 'bg-danger-500'
        : state === 'checking'
          ? 'bg-accent-400 animate-pulse'
          : 'bg-transparent';
  return <span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />;
}

function FieldHint({ state, value }: { state: Availability; value: string }) {
  if (value.length === 0)
    return <p className="mt-1.5 text-xs text-stone-500">3–20 תווים: אותיות באנגלית, ספרות וקו תחתון</p>;
  if (state === 'invalid')
    return <p className="mt-1.5 text-xs text-danger-600">שם לא תקין. השתמש ב־3–20 אותיות באנגלית, ספרות או _</p>;
  if (state === 'taken')
    return <p className="mt-1.5 text-xs text-danger-600">השם הזה כבר תפוס</p>;
  if (state === 'available')
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-success-600">
        <CheckIcon size={11} /> השם פנוי
      </p>
    );
  return <p className="mt-1.5 text-xs text-stone-500">בודק זמינות…</p>;
}
