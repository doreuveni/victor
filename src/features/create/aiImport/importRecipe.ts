import { supabase } from '@/lib/supabase';
import { downscaleForVision } from '@/lib/images';
import { emptyDraft, type DraftData } from '@/features/create/types';
import type { AiImportError, AiImportResponse } from './types';

export const MAX_IMPORT_IMAGES = 4;

interface ImportSuccess {
  ok: true;
  draft: DraftData;
}
interface ImportFailure {
  ok: false;
  error: AiImportError;
}

// Downscales the picked files client-side, sends them to the ai-recipe-import
// edge function, and maps the result onto a full DraftData ready to be
// upserted into recipe_drafts. Never uploads the source files to Storage.
export async function importRecipeFromPhotos(files: File[]): Promise<ImportSuccess | ImportFailure> {
  const images = await Promise.all(files.map(downscaleForVision));

  const { data, error } = await supabase.functions.invoke<AiImportResponse | { error: string }>(
    'ai-recipe-import',
    { body: { images } },
  );

  if (error || !data) return { ok: false, error: 'failed' };
  if ('error' in data) {
    return { ok: false, error: data.error === 'daily_limit_reached' ? 'daily_limit_reached' : 'failed' };
  }
  if (!data.found) return { ok: false, error: 'not_found' };

  const categoryId = data.category_slug ? await resolveCategoryId(data.category_slug) : null;

  const draft: DraftData = {
    ...emptyDraft(),
    title: data.title,
    caption: data.caption,
    category_id: categoryId,
    prep_min: data.prep_min,
    cook_min: data.cook_min,
    servings: data.servings,
    sections: data.sections.length > 0 ? data.sections.map((s) => ({ name: s.name, items: s.items })) : emptyDraft().sections,
    steps: data.steps.length > 0 ? data.steps.map((s) => ({ text: s.text, photo_url: null })) : emptyDraft().steps,
  };

  return { ok: true, draft };
}

async function resolveCategoryId(slug: string): Promise<string | null> {
  const { data } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
