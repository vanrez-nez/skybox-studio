import { FieldGroup } from "@/components/ui/primitives/field-group";
import { Widget } from "@/components/sidebar/panels/Widget";
import { ColorRow, SliderRow, ToggleRow } from "./fields";
import { useWorkspaceStore } from "@/store/app";

const degrees = (value: number) => `${Math.round(value)}°`;
const units = (value: number) => `${Math.round(value)}`;

// Scene parameters shared by every scenario: the sun, the ambient term, fog and the camera.
export function SceneWidget() {
  const sceneParams = useWorkspaceStore((state) => state.sceneParams);
  const updateSceneParams = useWorkspaceStore((state) => state.updateSceneParams);
  const { ambient, fog, sun } = sceneParams;

  return (
    <Widget title="Scene" contentClassName="grid gap-3">
      <FieldGroup collapsible contentClassName="grid gap-3" label="Sun">
        <ToggleRow
          label="Link to sky"
          onChange={(linkToSky) => updateSceneParams({ sun: { ...sun, linkToSky } })}
          value={sun.linkToSky}
        />
        {sun.linkToSky ? (
          <p className="text-xs text-muted-foreground/70">
            Direction and colour follow the sky's brightest spot layer.
          </p>
        ) : (
          <>
            <SliderRow
              format={degrees}
              label="Azimuth"
              max={360}
              min={0}
              onChange={(azimuth) => updateSceneParams({ sun: { ...sun, azimuth } })}
              step={1}
              value={sun.azimuth}
            />
            <SliderRow
              format={degrees}
              label="Elevation"
              max={90}
              min={-15}
              onChange={(elevation) => updateSceneParams({ sun: { ...sun, elevation } })}
              step={1}
              value={sun.elevation}
            />
            <ColorRow
              label="Colour"
              onChange={(color) => updateSceneParams({ sun: { ...sun, color } })}
              value={sun.color}
            />
          </>
        )}
        <SliderRow
          label="Intensity"
          max={8}
          min={0}
          onChange={(intensity) => updateSceneParams({ sun: { ...sun, intensity } })}
          step={0.05}
          value={sun.intensity}
        />
      </FieldGroup>

      <FieldGroup collapsible contentClassName="grid gap-3" label="Ambient">
        <ColorRow
          label="Sky"
          onChange={(skyColor) => updateSceneParams({ ambient: { ...ambient, skyColor } })}
          value={ambient.skyColor}
        />
        <ColorRow
          label="Ground"
          onChange={(groundColor) => updateSceneParams({ ambient: { ...ambient, groundColor } })}
          value={ambient.groundColor}
        />
        <SliderRow
          label="Intensity"
          max={4}
          min={0}
          onChange={(intensity) => updateSceneParams({ ambient: { ...ambient, intensity } })}
          step={0.05}
          value={ambient.intensity}
        />
        <SliderRow
          label="Sky lighting"
          max={3}
          min={0}
          onChange={(environmentIntensity) =>
            updateSceneParams({ ambient: { ...ambient, environmentIntensity } })
          }
          step={0.05}
          value={ambient.environmentIntensity}
        />
      </FieldGroup>

      <FieldGroup collapsible contentClassName="grid gap-3" label="Fog">
        <ToggleRow
          label="Enabled"
          onChange={(enabled) => updateSceneParams({ fog: { ...fog, enabled } })}
          value={fog.enabled}
        />
        <ColorRow
          label="Colour"
          onChange={(color) => updateSceneParams({ fog: { ...fog, color } })}
          value={fog.color}
        />
        <SliderRow
          format={units}
          label="Near"
          max={1000}
          min={0}
          onChange={(near) => updateSceneParams({ fog: { ...fog, near } })}
          step={5}
          value={fog.near}
        />
        <SliderRow
          format={units}
          label="Far"
          max={3000}
          min={10}
          onChange={(far) => updateSceneParams({ fog: { ...fog, far } })}
          step={10}
          value={fog.far}
        />
      </FieldGroup>

      <FieldGroup collapsible contentClassName="grid gap-3" label="Camera">
        <SliderRow
          format={degrees}
          label="Field of view"
          max={110}
          min={20}
          onChange={(fov) => updateSceneParams({ fov })}
          step={1}
          value={sceneParams.fov}
        />
      </FieldGroup>
    </Widget>
  );
}
