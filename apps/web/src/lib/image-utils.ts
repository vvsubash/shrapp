import { IMAGE_MAX_DIM, JPEG_QUALITY } from "@shrapp/shared";

export async function preprocessImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_DIM / Math.max(img.width, img.height));

  if (scale === 1 && file.type === "image/jpeg") {
    return file;
  }

  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
}
