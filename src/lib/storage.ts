import { supabase } from './supabase';
import { processImage } from './images';

// Uploads must land under the user's own {uid}/ folder (enforced by storage RLS).
async function uploadBlobTo(bucket: string, userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function uploadTo(bucket: string, userId: string, file: File): Promise<string> {
  const blob = await processImage(file);
  return uploadBlobTo(bucket, userId, blob);
}

export const uploadRecipePhoto = (userId: string, file: File) =>
  uploadTo('recipe-photos', userId, file);

export const uploadAvatar = (userId: string, file: File) =>
  uploadTo('avatars', userId, file);

// For images already cropped/encoded client-side (the ImageCropper output) —
// skips re-processing since the canvas re-encode already resized and
// stripped metadata.
export const uploadRecipePhotoBlob = (userId: string, blob: Blob) =>
  uploadBlobTo('recipe-photos', userId, blob);

export const uploadAvatarBlob = (userId: string, blob: Blob) =>
  uploadBlobTo('avatars', userId, blob);
