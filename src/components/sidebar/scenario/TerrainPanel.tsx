import { FieldGroup } from "@/components/ui/primitives/field-group";
import { resolveTerrainParams, type TerrainParams } from "@/scenarios/terrain/params";
import { TERRAIN_SCENARIO_ID } from "@/scenarios/terrain";
import { useWorkspaceStore } from "@/store/app";
import { SliderRow } from "./fields";

const units = (value: number) => `${Math.round(value)}`;

export function TerrainPanel() {
  const stored = useWorkspaceStore((state) => state.scenarioParams[TERRAIN_SCENARIO_ID]) as
    | Partial<TerrainParams>
    | undefined;
  const params = resolveTerrainParams(stored);
  const updateScenarioParams = useWorkspaceStore((state) => state.updateScenarioParams);
  const set = (patch: Partial<TerrainParams>) =>
    updateScenarioParams(TERRAIN_SCENARIO_ID, patch as Record<string, unknown>);

  return (
    <div className="grid gap-3">
      <FieldGroup collapsible contentClassName="grid gap-3" label="Terrain">
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
          max={3000}
          min={0}
          onChange={(reliefHeight) => set({ reliefHeight })}
          step={25}
          value={params.reliefHeight}
        />
        <SliderRow
          label="Frequency"
          max={8}
          min={0.5}
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
          min={0.05}
          onChange={(gain) => set({ gain })}
          step={0.01}
          value={params.gain}
        />
        <SliderRow
          label="Roughness"
          max={1}
          min={0}
          onChange={(roughness) => set({ roughness })}
          step={0.01}
          value={params.roughness}
        />
      </FieldGroup>

      <FieldGroup collapsible contentClassName="grid gap-3" label="Erosion">
        <SliderRow
          label="Scale"
          max={0.3}
          min={0.05}
          onChange={(erosionScale) => set({ erosionScale })}
          step={0.01}
          value={params.erosionScale}
        />
        <SliderRow
          label="Strength"
          max={0.4}
          min={0}
          onChange={(erosionStrength) => set({ erosionStrength })}
          step={0.01}
          value={params.erosionStrength}
        />
        <SliderRow
          label="Gullies"
          max={1}
          min={0}
          onChange={(gullyWeight) => set({ gullyWeight })}
          step={0.01}
          value={params.gullyWeight}
        />
        <SliderRow
          label="Detail"
          max={3}
          min={0.5}
          onChange={(erosionDetail) => set({ erosionDetail })}
          step={0.05}
          value={params.erosionDetail}
        />
        <SliderRow
          format={units}
          label="Octaves"
          max={7}
          min={1}
          onChange={(erosionOctaves) => set({ erosionOctaves })}
          step={1}
          value={params.erosionOctaves}
        />
        <SliderRow
          label="Ridge rounding"
          max={1}
          min={0}
          onChange={(ridgeRounding) => set({ ridgeRounding })}
          step={0.01}
          value={params.ridgeRounding}
        />
        <SliderRow
          label="Crease rounding"
          max={1}
          min={0}
          onChange={(creaseRounding) => set({ creaseRounding })}
          step={0.01}
          value={params.creaseRounding}
        />
      </FieldGroup>
    </div>
  );
}
