import { createDefaultTerrainParams, type TerrainParams } from "@/scenarios/terrain/params";
import { TERRAIN_SCENARIO_ID } from "@/scenarios/terrain";
import { useWorkspaceStore } from "@/store/app";
import { ColorRow, SliderRow } from "./fields";

const units = (value: number) => `${Math.round(value)}`;

export function TerrainPanel() {
  const stored = useWorkspaceStore((state) => state.scenarioParams[TERRAIN_SCENARIO_ID]) as
    | Partial<TerrainParams>
    | undefined;
  // Merge rather than fall back wholesale: a params object persisted by an older build can be
  // missing fields, and a bare `??` would let those reach the sliders as undefined.
  const params: TerrainParams = { ...createDefaultTerrainParams(), ...stored };
  const updateScenarioParams = useWorkspaceStore((state) => state.updateScenarioParams);
  const set = (patch: Partial<TerrainParams>) =>
    updateScenarioParams(TERRAIN_SCENARIO_ID, patch as Record<string, unknown>);

  return (
    <div className="grid gap-3">
      <SliderRow
        format={units}
        label="Seed"
        max={9999}
        min={0}
        onChange={(seed) => set({ seed })}
        step={1}
        value={params.seed}
      />
      <SliderRow
        format={units}
        label="Extent"
        max={3000}
        min={400}
        onChange={(extent) => set({ extent })}
        step={50}
        value={params.extent}
      />
      <SliderRow
        format={units}
        label="Height"
        max={400}
        min={0}
        onChange={(height) => set({ height })}
        step={5}
        value={params.height}
      />
      <SliderRow
        label="Frequency"
        max={8}
        min={0.2}
        onChange={(frequency) => set({ frequency })}
        step={0.1}
        value={params.frequency}
      />
      <SliderRow
        format={units}
        label="Octaves"
        max={8}
        min={1}
        onChange={(octaves) => set({ octaves })}
        step={1}
        value={params.octaves}
      />
      <SliderRow
        label="Detail falloff"
        max={0.9}
        min={0.1}
        onChange={(gain) => set({ gain })}
        step={0.01}
        value={params.gain}
      />
      <ColorRow label="Low" onChange={(colorLow) => set({ colorLow })} value={params.colorLow} />
      <ColorRow
        label="High"
        onChange={(colorHigh) => set({ colorHigh })}
        value={params.colorHigh}
      />
      <SliderRow
        label="Roughness"
        max={1}
        min={0}
        onChange={(roughness) => set({ roughness })}
        step={0.01}
        value={params.roughness}
      />
    </div>
  );
}
