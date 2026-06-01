import { FieldGradientGroup } from "@/components/ui/composables/field-gradient-group";
import { fieldGradientLayerAdapter } from "@/effects/effect-layer";
import { useWorkspaceStore } from "@/store/app";
import { Widget } from "./Widget";

export const fieldGradientEffectLayerAdapter = fieldGradientLayerAdapter;

export function FieldGradientWidget() {
  const addFieldGradientAnchor = useWorkspaceStore((state) => state.addFieldGradientAnchor);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const fieldGradient = useWorkspaceStore((state) => state.fieldGradient);
  const randomizeFieldGradient = useWorkspaceStore((state) => state.randomizeFieldGradient);
  const removeFieldGradientAnchor = useWorkspaceStore((state) => state.removeFieldGradientAnchor);
  const resetFieldGradient = useWorkspaceStore((state) => state.resetFieldGradient);
  const selectFieldGradientAnchor = useWorkspaceStore((state) => state.selectFieldGradientAnchor);
  const setFieldGradientAmplitude = useWorkspaceStore((state) => state.setFieldGradientAmplitude);
  const setFieldGradientFrequency = useWorkspaceStore((state) => state.setFieldGradientFrequency);
  const setFieldGradientMode = useWorkspaceStore((state) => state.setFieldGradientMode);
  const setFieldGradientPower = useWorkspaceStore((state) => state.setFieldGradientPower);
  const updateFieldGradientAnchor = useWorkspaceStore((state) => state.updateFieldGradientAnchor);

  return (
    <Widget title="Field Gradient" contentClassName="space-y-4">
      <FieldGradientGroup
        onAddAnchor={addFieldGradientAnchor}
        onInteractionEnd={commitHistoryTransaction}
        onInteractionStart={beginHistoryTransaction}
        onRandomize={randomizeFieldGradient}
        onRemoveAnchor={removeFieldGradientAnchor}
        onReset={resetFieldGradient}
        onSelectAnchor={selectFieldGradientAnchor}
        onSetAmplitude={setFieldGradientAmplitude}
        onSetFrequency={setFieldGradientFrequency}
        onSetMode={setFieldGradientMode}
        onSetPower={setFieldGradientPower}
        onUpdateAnchor={updateFieldGradientAnchor}
        value={fieldGradient}
      />
    </Widget>
  );
}
