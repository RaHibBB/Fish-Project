import "server-only";
import { updateTag } from "next/cache";

/**
 * Every DB read in lib/server/queries.ts and lib/server/entry.ts is cached in Vercel's shared
 * cache under this tag ('use cache: remote'), so page views don't touch the database.
 * Every server action that writes calls dataChanged(), which expires the tag immediately:
 * the next request reads fresh data (read-your-own-writes), never a stale number.
 */
export const DATA_TAG = "farm-data";

export function dataChanged() {
  updateTag(DATA_TAG);
}
