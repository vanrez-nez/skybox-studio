import { CircleDot, Cloud, ImagePlus, Moon, Palette, Sparkles, Stars, Sun } from "lucide-react";

import { registerEffectLayerUi } from "@/effects/effect-layer";
import { CloudsWidget } from "./CloudsWidget";
import { FieldGradientWidget } from "./FieldGradientWidget";
import { GradientWidget } from "./GradientWidget";
import { ImageWidget } from "./ImageWidget";
import { MoonWidget } from "./MoonWidget";
import { SpotWidget } from "./SpotWidget";
import { StarfieldWidget } from "./StarfieldWidget";
import { SunWidget } from "./SunWidget";

// Attaches the built-in layer panels + icons to their registered addons so the
// sidebar and layers list are fully registry-driven. Imported once at app start.
registerEffectLayerUi("gradient", { Icon: Palette, Panel: GradientWidget });
registerEffectLayerUi("clouds", { Icon: Cloud, Panel: CloudsWidget });
registerEffectLayerUi("field-gradient", { Icon: Sparkles, Panel: FieldGradientWidget });
registerEffectLayerUi("spot", { Icon: CircleDot, Panel: SpotWidget });
registerEffectLayerUi("sun", { Icon: Sun, Panel: SunWidget });
registerEffectLayerUi("image", { Icon: ImagePlus, Panel: ImageWidget });
registerEffectLayerUi("moon", { Icon: Moon, Panel: MoonWidget });
registerEffectLayerUi("starfield", { Icon: Stars, Panel: StarfieldWidget });
