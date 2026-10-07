/** Resize + re-encode a photo as JPEG until it is at most `maxBytes` (default 200 KB). */
export async function compressImage(file: File, maxBytes = 200 * 1024): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let maxSide = 1600;
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      for (const quality of [0.8, 0.65, 0.5, 0.4]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
        if (blob && blob.size <= maxBytes) {
          return new File([blob], "receipt.jpg", { type: "image/jpeg" });
        }
      }
      maxSide = Math.round(maxSide * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new Error("could_not_compress");
}
