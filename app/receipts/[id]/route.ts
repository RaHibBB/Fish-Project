import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { readReceipt } from "@/lib/server/receipts";

/** Receipt photo for an expense (viewing is open to anyone with the link, like the rest of the ledger). */
export async function GET(_req: Request, ctx: RouteContext<"/receipts/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ receiptUrl: expenses.receiptUrl }).from(expenses).where(eq(expenses.id, id));
  if (!row?.receiptUrl) return new Response("Not found", { status: 404 });
  return (await readReceipt(row.receiptUrl)) ?? new Response("Not found", { status: 404 });
}
