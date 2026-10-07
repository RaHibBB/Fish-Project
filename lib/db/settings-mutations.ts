import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isISODate } from "@/lib/format";
import { normalizePhone } from "@/lib/auth/pin";
import type { DB } from "./client";
import { writeAudit } from "./audit";
import { MutationError } from "./mutations";
import { categories, partners, settings } from "./schema";
import { CATEGORY_ICON_NAMES } from "./seed-data";

export const settingsInput = z.object({
  farmName: z.string().trim().min(1).max(80),
  labourDailyWage: z.coerce.number().int().min(1).max(100_000),
  startDate: z
    .string()
    .refine((s) => s === "" || isISODate(s), "invalid_date")
    .transform((s) => (s === "" ? null : s)),
});

export async function updateSettings(db: DB, actorId: number, raw: z.input<typeof settingsInput>) {
  const data = settingsInput.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(settings).where(eq(settings.id, 1));
    const [row] = await tx
      .insert(settings)
      .values({ id: 1, ...data })
      .onConflictDoUpdate({ target: settings.id, set: data })
      .returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "settings", rowId: 1, before, after: row });
    return row;
  });
}

export const partnersInput = z
  .array(
    z.object({
      id: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(40),
      phone: z.string().transform((p, ctx) => {
        const n = normalizePhone(p);
        if (!n) ctx.addIssue({ code: "custom", message: "invalid_phone" });
        return n ?? "";
      }),
      shareBp: z.coerce.number().int().min(0).max(10000),
    }),
  )
  .min(1)
  .refine((ps) => ps.reduce((a, p) => a + p.shareBp, 0) === 10000, "shares_sum")
  .refine((ps) => new Set(ps.map((p) => p.phone)).size === ps.length, "duplicate_phone");

/** Names, phones and shares of all partners at once (shares must total 100%). */
export async function updatePartners(db: DB, actorId: number, raw: z.input<typeof partnersInput>) {
  const list = partnersInput.parse(raw);
  const existing = await db.select({ id: partners.id }).from(partners);
  if (existing.length !== list.length || !existing.every((e) => list.some((p) => p.id === e.id))) {
    throw new MutationError("unknown_partner");
  }
  return db.transaction(async (tx) => {
    // Free the phone numbers first so two partners can swap numbers without a unique clash.
    await tx.update(partners).set({ phone: sql`'tmp-' || ${partners.id}` });
    for (const p of list) {
      const [before] = await tx.select().from(partners).where(eq(partners.id, p.id));
      const [after] = await tx
        .update(partners)
        .set({ name: p.name, phone: p.phone, shareBp: p.shareBp })
        .where(eq(partners.id, p.id))
        .returning();
      await writeAudit(tx, { actorId, action: "update", tableName: "partners", rowId: p.id, before, after });
    }
  });
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.enum(CATEGORY_ICON_NAMES),
  color: hexColor,
  archived: z.boolean().default(false),
});

export async function createCategory(db: DB, actorId: number, raw: z.input<typeof categoryInput>) {
  const data = categoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${categories.sortOrder}), 0)::int` }).from(categories);
    const [row] = await tx
      .insert(categories)
      .values({ ...data, slug: `custom-${Date.now().toString(36)}`, sortOrder: max + 1 })
      .returning();
    await writeAudit(tx, { actorId, action: "create", tableName: "categories", rowId: row.id, after: row });
    return row;
  });
}

export async function updateCategory(db: DB, actorId: number, id: number, raw: z.input<typeof categoryInput>) {
  const data = categoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(categories).where(eq(categories.id, id));
    if (!before) throw new MutationError("not_found");
    const [row] = await tx.update(categories).set(data).where(eq(categories.id, id)).returning();
    await writeAudit(tx, { actorId, action: "update", tableName: "categories", rowId: id, before, after: row });
    return row;
  });
}
