import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import type { AppNotification } from './types';

const SELECT = `
  id, type, is_read, created_at, recipe_id,
  actor:profiles!notifications_actor_id_fkey ( username, display_name, avatar_url ),
  recipe:recipes ( title, cover_url )
`;

// Loads the recent notification list + unread count, and subscribes to
// Realtime INSERTs so the bell badge updates live without polling.
export function useNotifications() {
  const { session } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const userId = session?.user.id;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!userId) return;
    setLoaded(false);

    supabase
      .from('notifications')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const rows = (data ?? []) as unknown as AppNotification[];
        setItems(rows);
        setUnread(rows.filter((n) => !n.is_read).length);
        setLoaded(true);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
        async (payload) => {
          const { data } = await supabase.from('notifications').select(SELECT).eq('id', payload.new.id).single();
          if (!data) return;
          setItems((prev) => [data as unknown as AppNotification, ...prev].slice(0, 30));
          setUnread((c) => c + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  async function markAllRead() {
    if (!userId || unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false);
  }

  return { items, unread, loaded, markAllRead };
}
