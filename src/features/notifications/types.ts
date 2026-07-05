export type NotificationType = 'follow' | 'like' | 'comment' | 'collection_add' | 'new_post';

export interface AppNotification {
  id: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  recipe_id: string | null;
  actor: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  recipe: { title: string; cover_url: string | null } | null;
}
