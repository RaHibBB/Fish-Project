// One-off helper: set each partner's "ফান্ডে জমা" to the real amount (used from a Vercel build step
// because the production DB can't be reached from a laptop). Edits are audit-logged with
// before/after, exactly like an edit made in the app, and old values stay visible in the history.
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { todayISO } from "@/lib/format";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import { contributions, partners } from "./schema";

export const fundSetupInput = z.object({
  /** used only when a partner has no contribution yet (yyyy-mm-dd) */
  date: z.string().optional(),
  contributions: z.record(
    z.string(),
    z.object({
      /** taka put into the fund (money a partner paid for expenses directly is NOT included) */
      amount: z.number().int().min(1),
      note: z.string().max(200).default(""),
    }),
  ),
});
export type FundSetup = z.input<typeof fundSetupInput>;

export type FundFixResult = { partner: string; action: "updated" | "created" | "unchanged" | "skipped"; detail: string };

export async function applyFundContributions(db: DB, raw: FundSetup): Promise<FundFixResult[]> {
  const setup = fundSetupInput.parse(raw);
  const out: FundFixResult[] = [];
  for (const [name, want] of Object.entries(setup.contributions)) {
    const [p] = await db.select().from(partners).where(and(eq(partners.name, name), eq(partners.isPartner, true)));
    if (!p) {
      out.push({ partner: name, action: "skipped", detail: "no such partner" });
      continue;
    }
    const rows = await db
      .select()
      .from(contributions)
      .where(and(eq(contributions.partnerId, p.id), isNull(contributions.voidedAt)));
    if (rows.length > 1) {
      out.push({ partner: name, action: "skipped", detail: `${rows.length} contributions — edit in the app` });
      continue;
    }
    if (rows.length === 0) {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(contributions)
          .values({ date: setup.date ?? todayISO(), partnerId: p.id, amount: want.amount, method: "cash", note: want.note })
          .returning();
        await writeAudit(tx, { actorId: null, action: "create", tableName: "contributions", rowId: row.id, after: row });
      });
      out.push({ partner: name, action: "created", detail: String(want.amount) });
      continue;
    }
    const [before] = rows;
    if (before.amount === want.amount && before.note === want.note) {
      out.push({ partner: name, action: "unchanged", detail: String(want.amount) });
      continue;
    }
    await db.transaction(async (tx) => {
      const [after] = await tx
        .update(contributions)
        .set({ amount: want.amount, note: want.note, updatedAt: new Date() })
        .where(eq(contributions.id, before.id))
        .returning();
      await writeAudit(tx, { actorId: null, action: "update", tableName: "contributions", rowId: before.id, before, after });
    });
    out.push({ partner: name, action: "updated", detail: `${before.amount} → ${want.amount}` });
  }
  return out;
}
