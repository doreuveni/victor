// Client-side image pipeline: HEIC -> JPEG, downscale, compress, strip EXIF.
// Canvas re-encoding drops all metadata (incl. GPS), so EXIF stripping is free.

const MAX_DIM = 1600; // longest edge, px
const QUALITY = 0.82;

function isHeic(file: File): boolean {
  return (
    /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
  );
}

/**
 * HEIC-aware decode to a usable <img> element (used directly by the cropper,
 * which keeps it around for the whole editing session). Caller owns the
 * returned element's object URL and must revoke it when done —
 * `URL.revokeObjectURL(img.src)`.
 */
export async function decodeToImage(file: File): Promise<HTMLImageElement> {
  let source: Blob = file;
  if (isHeic(file)) {
    // Dynamic import keeps the ~1.5MB libheif wasm out of the initial bundle.
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }
  return loadImage(source);
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = url;
  });
  return img;
}

/**
 * Process a user-picked image file into a compressed JPEG Blob.
 * Handles iPhone HEIC, downscales to MAX_DIM, strips metadata.
 */
export async function processImage(file: File): Promise<Blob> {
  const img = await decodeToImage(file);
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unsupported');
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob) throw new Error('image encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
