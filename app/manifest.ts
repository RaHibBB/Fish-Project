import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "চৌধুরী ব্রাদার্স এগ্রো — হিসাব",
    short_name: "খামারের হিসাব",
    description: "খরচ ও পার্টনারদের টাকার হিসাব",
    lang: "bn",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f8a6a",
    categories: ["finance", "business"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android) for these.
    shortcuts: [
      { name: "নতুন খরচ", short_name: "খরচ", url: "/add", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "টাকা দিন", short_name: "জমা", url: "/contribute", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "হিসাব", short_name: "হিসাব", url: "/ledger", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
