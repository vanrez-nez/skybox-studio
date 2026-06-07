import { FieldGradientGroup } from "@/components/ui/composables/field-gradient-group";
import {
  createDefaultFieldGradientState,
  type FieldGradientState,
} from "@/effects/layers/field-gradient/state";
import {
  addFieldGradientAnchor,
  randomizeFieldGradient,
  removeFieldGradientAnchor,
  resetFieldGradient,
  selectFieldGradientAnchor,
  setFieldGradientAmplitude,
  setFieldGradientFrequency,
  setFieldGradientMode,
  setFieldGradientPower,
  updateFieldGradientAnchor,
} from "@/effects/layers/field-gradient/operations";
import { useWorkspaceStore } from "@/store/app";
import { useSelectedLayerParams } from "@/store/use-selected-layer";
import { Widget } from "./Widget";

export function FieldGradientWidget() {
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const updateSelectedLayerParams = useWorkspaceStore((state) => state.updateSelectedLayerParams);
  const fieldGradient =
    useSelectedLayerParams<FieldGradientState>("field-gradient") ?? createDefaultFieldGradientState();

  return (
    <Widget title="Field Gradient" contentClassName="space-y-4">
      <FieldGradientGroup
        onAddAnchor={(anchor) =>
          updateSelectedLayerParams((params) =>
            addFieldGradientAnchor(params as FieldGradientState, anchor)
          )
        }
        onInteractionEnd={commitHistoryTransaction}
        onInteractionStart={beginHistoryTransaction}
        onRandomize={() =>
          updateSelectedLayerParams((params) => randomizeFieldGradient(params as FieldGradientState))
        }
        onRemoveAnchor={(id) =>
          updateSelectedLayerParams((params) =>
            removeFieldGradientAnchor(params as FieldGradientState, id)
          )
        }
        onReset={() => updateSelectedLayerParams(() => resetFieldGradient())}
        onSelectAnchor={(id) =>
          updateSelectedLayerParams(
            (params) => selectFieldGradientAnchor(params as FieldGradientState, id),
            { history: "skip" }
          )
        }
        onSetAmplitude={(amplitude, options) =>
          updateSelectedLayerParams(
            (params) => setFieldGradientAmplitude(params as FieldGradientState, amplitude),
            options
          )
        }
        onSetFrequency={(frequency, options) =>
          updateSelectedLayerParams(
            (params) => setFieldGradientFrequency(params as FieldGradientState, frequency),
            options
          )
        }
        onSetMode={(mode) =>
          updateSelectedLayerParams((params) =>
            setFieldGradientMode(params as FieldGradientState, mode)
          )
        }
        onSetPower={(power, options) =>
          updateSelectedLayerParams(
            (params) => setFieldGradientPower(params as FieldGradientState, power),
            options
          )
        }
        onUpdateAnchor={(id, update, options) =>
          updateSelectedLayerParams(
            (params) => updateFieldGradientAnchor(params as FieldGradientState, id, update),
            options
          )
        }
        value={fieldGradient}
      />
    </Widget>
  );
}
