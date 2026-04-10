import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Baby Monitor",
    short_name: "Baby Monitor",
    description:
      "Privacy-first peer-to-peer audio baby monitor. No accounts, no tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#7C3AED",
    orientation: "portrait",
    categories: ["utilities", "lifestyle"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
