import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Avatar from '@/components/Avatar';

interface Suggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

// Single-line comment input with @username autocomplete. Detects an
// in-progress "@word" at the caret, queries the existing search_profiles RPC
// (same one the people-search page uses), and splices the picked username
// back in on selection.
export default function MentionInput({ value, onChange, onSubmit, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  function detectMention(text: string, caret: number) {
    const upToCaret = text.slice(0, caret);
    const match = upToCaret.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (!match) {
      setMentionStart(null);
      setSuggestions([]);
      return;
    }
    const query = match[1];
    const start = caret - query.length - 1; // position of the "@"
    setMentionStart(start);
    clearTimeout(debounce.current);
    if (query.length === 0) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_profiles', { p_query: query, p_limit: 6 });
      setSuggestions((data ?? []) as Suggestion[]);
    }, 200);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function pick(username: string) {
    if (mentionStart === null || !inputRef.current) return;
    const caret = inputRef.current.selectionStart ?? value.length;
    const next = `${value.slice(0, mentionStart)}@${username} ${value.slice(caret)}`;
    onChange(next);
    setSuggestions([]);
    setMentionStart(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions.length === 0) onSubmit();
          if (e.key === 'Escape') setSuggestions([]);
        }}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {suggestions.length > 0 && (
        <ul className="absolute bottom-full z-10 mb-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s.username)}
                className="flex min-h-11 w-full items-center gap-2 px-3 hover:bg-stone-50"
              >
                <Avatar url={s.avatar_url} name={s.display_name || s.username} size={24} />
                <span className="text-sm">
                  <span className="font-medium">{s.display_name || s.username}</span>{' '}
                  <span className="text-stone-400">
                    <span className="ltr">@{s.username}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
