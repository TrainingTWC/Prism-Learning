/**
 * Convert an image File to WebP format using the Canvas API.
 * Caps the longer dimension at `maxPx` and compresses at `quality`.
 * Non-image files are returned unchanged.
 *
 * Animated GIFs are also returned unchanged: the Canvas API can only ever
 * capture the single currently-decoded frame of a GIF (drawImage + toBlob
 * has no concept of animation), so running a GIF through this pipeline
 * silently and permanently flattens it to a static image. Skipping
 * conversion preserves the animation.
 */
export async function toWebP(file: File, maxPx = 1920, quality = 0.82): Promise<File> {
  if (file.type === 'image/gif') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          resolve(
            new File([blob!], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }),
          );
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback: upload original
    };
    img.src = objectUrl;
  });
}
