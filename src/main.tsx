import "./styles.css";

import { preloadAssets } from "@/lib/preload";

// Warm the cache for the app chunks + eager assets with real 0–100% progress before the import chain
// (which then runs from cache). Prod-only; dev has no build manifest and keeps the indeterminate bar.
// Keeping this entry tiny is the point — everything else loads behind the dynamic import, so there is
// something left to preload by the time this runs.
if (import.meta.env.PROD) await preloadAssets();

const { mountApp } = await import("@/components/app/mount");
await mountApp();
