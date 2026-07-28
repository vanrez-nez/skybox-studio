import { setLoadProgress } from "@/lib/load-progress";
import { splashHidden } from "@/lib/splash-prefs";

type ManifestEntry = { url: string; bytes: number };

const SPLASH_ASSET_URL = "assets/splash.webp";

// Warm the HTTP cache for the app's chunks + eager assets while reporting real byte progress, so the
// subsequent dynamic-import chain in main.tsx runs from cache. Prod-only (dev has no build manifest and
// serves unbundled modules). Never rejects — any failure falls back to the indeterminate bar.
export async function preloadAssets(): Promise<void> {
  try {
    const base = import.meta.env.BASE_URL;
    const manifestRes = await fetch(`${base}load-manifest.json`);
    if (!manifestRes.ok) return;
    const entries = (await manifestRes.json()) as ManifestEntry[];

    // With the splash suppressed the image never downloads — drop it so the total stays accurate.
    const files = splashHidden()
      ? entries.filter((entry) => entry.url !== SPLASH_ASSET_URL)
      : entries;

    const total = files.reduce((sum, entry) => sum + entry.bytes, 0);
    if (total <= 0) return;

    let received = 0;
    setLoadProgress(0);

    await Promise.all(
      files.map(async (entry) => {
        const response = await fetch(`${base}${entry.url}`);
        if (!response.ok || !response.body) {
          // Count the whole file so the bar can still reach 100 even if this fetch can't be streamed.
          received += entry.bytes;
          setLoadProgress((received / total) * 100);
          return;
        }
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          setLoadProgress((received / total) * 100);
        }
      }),
    );

    setLoadProgress(100);
  } catch {
    // Never block boot on the preloader.
  }
}
