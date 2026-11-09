import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { duePayments } from "@/lib/db/schema";
import { readReceipt } from "@/lib/server/receipts";

/** Receipt photo for a shop-credit payment (viewing is open to anyone with the link). */
export async function GET(_req: Request, ctx: RouteContext<"/receipts/duepayment/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ receiptUrl: duePayments.receiptUrl }).from(duePayments).where(eq(duePayments.id, id));
  if (!row?.receiptUrl) return new Response("Not found", { status: 404 });
  return (await readReceipt(row.receiptUrl)) ?? new Response("Not found", { status: 404 });
}
