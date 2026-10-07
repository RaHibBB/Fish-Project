import "server-only";
import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";

export const MAX_RECEIPT_BYTES = 200 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ReceiptError extends Error {}

/**
 * Store a (client-compressed) receipt photo and return the value for expenses.receipt_url.
 * Production: a *private* Vercel Blob (only reachable through /receipts/[id] after login).
 * Development without BLOB_READ_WRITE_TOKEN: an inline data: URL so the feature still works.
 */
export async function storeReceipt(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) throw new ReceiptError("bad_type");
  // A little slack over 200 KB for multipart overhead / odd encoders.
  if (file.size > MAX_RECEIPT_BYTES * 1.1) throw new ReceiptError("too_big");

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`receipts/${randomUUID()}.jpg`, file, {
      access: "private",
      contentType: file.type,
    });
    return blob.url;
  }
  if (process.env.NODE_ENV === "production") throw new ReceiptError("not_configured");
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

/** Load a stored receipt as a Response body. */
export async function readReceipt(stored: string): Promise<Response | null> {
  const headers = { "Cache-Control": "private, max-age=86400" };
  if (stored.startsWith("data:")) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(stored);
    if (!m) return null;
    return new Response(Buffer.from(m[2], "base64"), { headers: { ...headers, "Content-Type": m[1] } });
  }
  const result = await get(stored, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  return new Response(result.stream, { headers: { ...headers, "Content-Type": result.blob.contentType } });
}
