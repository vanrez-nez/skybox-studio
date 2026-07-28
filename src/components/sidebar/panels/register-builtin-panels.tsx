import { CircleDot, Cloud, ImagePlus, Palette, Sparkles, Stars } from "lucide-react";

import { registerEffectLayerUi } from "@/effects/effect-layer";
import { CloudsWidget } from "./CloudsWidget";
import { FieldGradientWidget } from "./FieldGradientWidget";
import { GradientWidget } from "./GradientWidget";
import { ImageWidget } from "./ImageWidget";
import { SpotWidget } from "./SpotWidget";
import { StarfieldWidget } from "./StarfieldWidget";

// Attaches the built-in layer panels + icons to their registered addons so the
// sidebar and layers list are fully registry-driven. Imported once at app start.
registerEffectLayerUi("gradient", { Icon: Palette, Panel: GradientWidget });
registerEffectLayerUi("clouds", { Icon: Cloud, Panel: CloudsWidget });
registerEffectLayerUi("field-gradient", { Icon: Sparkles, Panel: FieldGradientWidget });
registerEffectLayerUi("spot", { Icon: CircleDot, Panel: SpotWidget });
registerEffectLayerUi("image", { Icon: ImagePlus, Panel: ImageWidget });
registerEffectLayerUi("starfield", { Icon: Stars, Panel: StarfieldWidget });
