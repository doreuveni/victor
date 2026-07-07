// AI recipe import — takes 1-4 downscaled recipe photos/screenshots and asks
// Claude to transcribe+structure them into the app's DraftData shape. Source
// images are never persisted (not passed to Storage, not returned) — this
// function only ever returns JSON.
//
// Auth: the client's JWT is forwarded automatically by supabase.functions.invoke,
// so the Supabase client here runs as the calling user — the daily-cap check
// goes through try_increment_ai_import_count() (SECURITY DEFINER), not a
// service-role key, keeping authorization in Postgres per this project's model.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.68';

const MAX_IMAGES = 4;
const DAILY_LIMIT = 20;

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    found: {
      type: 'boolean',
      description: 'true if the image(s) contain a legible recipe (title, ingredients, or steps); false if not a recipe at all.',
    },
    title: { type: 'string' },
    caption: { type: 'string' },
    category_slug: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'The best-matching slug from the provided category list, or null if none fit.',
    },
    prep_min: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    cook_min: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    servings: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'items'],
        additionalProperties: false,
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  required: ['found', 'title', 'caption', 'category_slug', 'prep_min', 'cook_min', 'servings', 'sections', 'steps'],
  additionalProperties: false,
} as const;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let body: { images?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const images = body.images;
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    return json({ error: 'invalid_images' }, 400);
  }
  if (!images.every((img) => typeof img === 'string' && img.length > 0)) {
    return json({ error: 'invalid_images' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: allowed, error: rpcErr } = await supabase.rpc('try_increment_ai_import_count', {
    p_limit: DAILY_LIMIT,
  });
  if (rpcErr) {
    return json({ error: 'rate_limit_check_failed' }, 500);
  }
  if (!allowed) {
    return json({ error: 'daily_limit_reached' }, 429);
  }

  const { data: categories, error: catErr } = await supabase.from('categories').select('slug, name_he');
  if (catErr) {
    return json({ error: 'internal' }, 500);
  }
  const categoryList = (categories ?? []).map((c) => `${c.slug} (${c.name_he})`).join(', ');

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      system:
        'You transcribe recipes from photos of text — screenshots, printed pages, or handwritten cards — into structured data. ' +
        'Only transcribe what is actually written or clearly implied; never invent ingredients, quantities, or steps that are not present. ' +
        'If the image(s) do not contain a legible recipe, set found=false and leave the other fields empty. ' +
        `Pick category_slug only from this list (or null if none fit well): ${categoryList}.`,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((data) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
            })),
            { type: 'text' as const, text: 'Transcribe the recipe in these image(s) into the required JSON shape.' },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
    });
  } catch {
    return json({ error: 'ai_call_failed' }, 502);
  }

  if (response.stop_reason === 'refusal') {
    return json({ error: 'refused' }, 502);
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return json({ error: 'empty_response' }, 502);
  }

  let result: unknown;
  try {
    result = JSON.parse(textBlock.text);
  } catch {
    return json({ error: 'malformed_response' }, 502);
  }

  return json(result, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
