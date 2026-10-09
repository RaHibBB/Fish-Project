"use client";

// Entries that couldn't be sent (no network) wait here, in this phone's localStorage, and are
// re-sent later. Each carries the clientId it was first sent with, so the server never saves
// the same entry twice even if an earlier attempt actually reached it.
import { saveExpenseAction } from "@/app/(app)/add/actions";
import { saveMoneyAction, type MoneyInput } from "@/app/(app)/contribute/actions";
import { saveSaleAction, type SaleFormInput } from "@/app/(app)/sale/actions";

export type ExpensePayload = Record<string, string> & { receiptDataUrl?: string };

export type OutboxItem =
  | { id: string; kind: "expense"; payload: ExpensePayload; summary: string; savedAt: number; error?: string }
  | { id: string; kind: "money"; payload: MoneyInput; summary: string; savedAt: number; error?: string }
  | { id: string; kind: "sale"; payload: SaleFormInput; summary: string; savedAt: number; error?: string };

const KEY = "farm-outbox";
const EVENT = "farm-outbox-change";

export function readOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked — nothing more we can do on this device
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onOutboxChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

export function queue(item: OutboxItem) {
  writeOutbox([...readOutbox().filter((i) => i.id !== item.id), item]);
}

export function discard(id: string) {
  writeOutbox(readOutbox().filter((i) => i.id !== id));
}

/** A failed server-action call that never got an answer (offline, dropped connection). */
export function isNetworkError(err: unknown) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || err instanceof TypeError;
}

async function expenseFormData(p: ExpensePayload): Promise<FormData> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(p)) if (k !== "receiptDataUrl") fd.set(k, v);
  if (p.receiptDataUrl) {
    const blob = await (await fetch(p.receiptDataUrl)).blob();
    fd.set("receipt", new File([blob], "receipt.jpg", { type: blob.type || "image/jpeg" }));
  }
  return fd;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

let flushing = false;

/** Try to send everything waiting. Returns how many were sent. */
export async function flushOutbox(): Promise<number> {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of readOutbox()) {
      try {
        const res =
          item.kind === "expense"
            ? await saveExpenseAction(await expenseFormData(item.payload))
            : item.kind === "money"
              ? await saveMoneyAction(item.payload)
              : await saveSaleAction(item.payload);
        if (res.ok) {
          discard(item.id);
          sent++;
        } else {
          // The server refused it (e.g. a rule changed); keep it so the person can see why.
          writeOutbox(readOutbox().map((i) => (i.id === item.id ? { ...i, error: res.error } : i)));
        }
      } catch {
        break; // still offline — try again later
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
