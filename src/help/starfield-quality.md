---
title: Starfield Quality
description: Memory budget for the procedural Runtime export — it has no effect on Image exports, which always bake at maximum fidelity.
---

**Quality only matters when you export as a Runtime.** It sets the GPU memory budget the procedural
starfield is allowed to use when the Runtime regenerates its stars and nebula on the fly — a larger
budget keeps more, sharper tiles at the cost of more VRAM and slower generation.

When you **export as an Image**, this setting is ignored: the starfield is flattened once to a static
equirect texture, so there is no ongoing memory budget to respect. Image exports always bake at the
**highest** quality, regardless of what you pick here — no need to bump it up before an 8K export.

It does **not** change the look you author (density, size, colors). It only governs how faithfully
that look is reproduced by the procedural Runtime.

- **Low** — smallest budget (~128 MB). Fastest generation, lowest memory; best for weaker GPUs or
  constrained Runtime targets. Very dense/fine starfields may lose some detail.
- **Medium** — balanced (~512 MB). The default; good detail for most Runtime scenes.
- **High** — largest budget (~2 GB). Maximum fidelity for dense fields, but the heaviest on memory
  and the slowest to generate.

> Tip: pick the Quality that matches the device your **Runtime** will run on. For **Image** exports,
> leave it wherever — the bake is always full quality.
