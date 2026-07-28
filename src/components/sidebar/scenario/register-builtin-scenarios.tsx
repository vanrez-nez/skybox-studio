import { Ban, Mountain } from "lucide-react";

// Importing the scenario modules is what registers them — same side-effect pattern as the layer
// addons. Keep these imports above registerScenarioUi so the addons exist first.
import "@/scenarios/none";
import "@/scenarios/terrain";
import { NONE_SCENARIO_ID } from "@/scenarios/none";
import { registerScenarioUi } from "@/scenarios/scenario";
import { TERRAIN_SCENARIO_ID } from "@/scenarios/terrain";
import { TerrainPanel } from "./TerrainPanel";

// Attaches the built-in scenario panels + icons to their registered addons so the Preview sidebar
// is fully registry-driven. Imported once at app start.
registerScenarioUi(NONE_SCENARIO_ID, { Icon: Ban });
registerScenarioUi(TERRAIN_SCENARIO_ID, { Icon: Mountain, Panel: TerrainPanel });
