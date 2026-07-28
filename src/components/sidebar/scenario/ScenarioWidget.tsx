import { Widget } from "@/components/sidebar/panels/Widget";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { findScenarioAddon, getScenarioAddons } from "@/scenarios/scenario";
import { useWorkspaceStore } from "@/store/app";

// Scenario picker + the active scenario's own params panel.
export function ScenarioWidget() {
  const activeScenarioId = useWorkspaceStore((state) => state.activeScenarioId);
  const setActiveScenario = useWorkspaceStore((state) => state.setActiveScenario);
  const addons = getScenarioAddons();
  const ActivePanel = findScenarioAddon(activeScenarioId)?.Panel;

  return (
    <Widget title="Scenario" contentClassName="grid gap-3">
      <div className="widget-inline-fields">
        <div className="widget-field widget-field-mode">
          <span className="text-xs">Preset</span>
          <Select onValueChange={setActiveScenario} value={activeScenarioId}>
            <SelectTrigger
              aria-label="Preview scenario"
              className="min-w-0 flex-1 bg-background text-xs"
              size="xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addons.map((addon) => (
                <SelectItem className="text-xs" key={addon.id} value={addon.id}>
                  {addon.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {ActivePanel ? <ActivePanel /> : null}
    </Widget>
  );
}
