import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  );
}

// Untyped client for now. Once a Supabase project is linked, regenerate types
// with `supabase gen types typescript --linked > src/lib/types.ts` and switch
// this to `createClient<Database>(...)`.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
