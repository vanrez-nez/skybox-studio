---
title: Starfield Quality
description: How much GPU memory the starfield bake may use — higher quality renders finer detail at a higher cost.
---

**Quality** sets the memory budget the starfield is allowed to use when it bakes its stars and
nebula into the equirect texture. A larger budget lets the baker keep more, sharper tiles, so fine
stars and crisp nebula edges survive — at the cost of more VRAM and slower bakes.

It does **not** change the look you author (density, size, colors). It only governs how faithfully
that look is captured when rendered and exported.

- **Low** — smallest budget (~128 MB). Fastest bakes, lowest memory; best for quick iteration or
  weaker GPUs. Very dense/fine starfields may lose some detail.
- **Medium** — balanced (~512 MB). The default; good detail for most scenes.
- **High** — largest budget (~2 GB). Maximum fidelity for dense fields and large exports, but the
  slowest to bake and the heaviest on memory.

> Tip: author at **Medium**, then switch to **High** before an 8K export if you need every star to
> survive.
