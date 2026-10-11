// What a "someone added / changed an entry" notification says, and who receives it.
import { describeActivity } from "./activity";

type Lookup = Parameters<typeof describeActivity>[1];

export type EntryEvent = {
  actorId: number;
  action: "create" | "update" | "void";
  tableName: string;
  row: { id: number } & Record<string, unknown>;
};

/** e.g. { title: "রাফি যোগ করেছেন", body: "খরচ: শ্রমিক মজুরি (৬ জন) ৳৪,৯২০", url: "/ledger/expense/7" } */
export function buildEntryNotification(event: EntryEvent, lookup: Lookup) {
  const [line] = describeActivity(
    [
      {
        id: 0,
        actorId: event.actorId,
        action: event.action,
        tableName: event.tableName,
        rowId: event.row.id,
        before: null,
        after: event.row,
        createdAt: new Date(),
      },
    ],
    lookup,
  );
  return {
    title: `${line.who} ${line.verb}`,
    body: line.what,
    url: event.tableName === "feedings" ? "/feeding" : (line.href ?? "/ledger"),
    // Same tag = a re-send replaces the earlier notification instead of stacking a duplicate.
    tag: `entry-${event.tableName}-${event.row.id}`,
  };
}

/** Everyone except the person who just made the change (they know). Devices with no owner still get it. */
export function notificationTargets<T extends { partnerId: number | null }>(subs: T[], actorId: number): T[] {
  return subs.filter((s) => s.partnerId !== actorId);
}
