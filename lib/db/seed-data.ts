/** Seeded categories. `slug` is stable; name/icon/colour are editable in Settings. */
export const SEED_CATEGORIES = [
  { slug: "labour", name: "শ্রমিক মজুরি", icon: "users", color: "#0f8a6a" },
  { slug: "feed", name: "খাবার", icon: "wheat", color: "#d97706" },
  { slug: "fry", name: "পোনা", icon: "fish", color: "#0284c7" },
  { slug: "lime_fertilizer", name: "চুন ও সার", icon: "sprout", color: "#65a30d" },
  { slug: "medicine", name: "ওষুধ", icon: "pill", color: "#db2777" },
  { slug: "lease", name: "লিজ/ভাড়া", icon: "landmark", color: "#7c3aed" },
  { slug: "pond_prep", name: "পুকুর খনন ও প্রস্তুতি", icon: "shovel", color: "#92400e" },
  { slug: "equipment", name: "যন্ত্রপাতি ও পাইপ", icon: "wrench", color: "#475569" },
  { slug: "irrigation", name: "পানি সেচ ও পাম্প", icon: "droplets", color: "#0891b2" },
  { slug: "transport", name: "পরিবহন", icon: "truck", color: "#ea580c" },
  { slug: "guard", name: "পাহারা", icon: "shield", color: "#1d4ed8" },
  { slug: "other", name: "অন্যান্য", icon: "ellipsis", color: "#6b7280" },
] as const;

/** Icons a category may use (rendered by components/category-icon.tsx). */
export const CATEGORY_ICON_NAMES = [
  "users",
  "wheat",
  "fish",
  "sprout",
  "pill",
  "landmark",
  "shovel",
  "wrench",
  "droplets",
  "truck",
  "shield",
  "ellipsis",
] as const;

export type CategorySlug = (typeof SEED_CATEGORIES)[number]["slug"];

/** Partners in display order. Shares default to 1/3 each and are editable in Settings. */
export const SEED_PARTNERS = [
  { name: "রাফি", shareBp: 3334 },
  { name: "রিয়াজ", shareBp: 3333 },
  { name: "অভি", shareBp: 3333 },
] as const;

export const DEFAULT_LABOUR_WAGE = 820;
