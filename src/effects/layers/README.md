# Effect layers

Each layer type is a self-contained addon. Adding a layer is **one folder + three
registrations** — no edits to the runtime core, the store core, or the sidebar.

## Folder layout (`src/effects/layers/<type>/`)

- `state.ts` — the layer's param type (`XState`), `createDefaultXState`, and
  `cloneXState`. Shared primitives (`GradientStop`, `clamp*`) live in
  `src/effects/layers/primitives.ts`.
- `operations.ts` — pure `params -> params` editing helpers. **Return the same
  reference on a no-op** so the store can skip empty history checkpoints.
- `panel.tsx` (currently under `src/components/sidebar/panels/`) — the sidebar UI.
  It reads the selected layer's params with `useSelectedLayerParams<XState>(type)`
  and writes via `updateSelectedLayerParams(producer, options)` /
  `updateLayerParams(layerId, producer, options)`.

## The three registrations

1. **App addon** — `registerEffectLayerAddon(addon)` (`@/effects/effect-layer`).
   The `EffectLayerAddon` supplies `createDefaultParams`, `defaultBlendMode`,
   `cloneParams`, `serialize`/`load`, `toManifestParams`, optional
   `transformCapabilities`, and `runtime.{getTopologyKey, updateLayerParams}`.
2. **Runtime adapter** — `registerLayerRuntimeAdapter(adapter)` (`@/runtime`).
   Supplies `sampleCpu` (preview/bake), `wgsl`/`glsl` (live), `updateLive`
   (Direct pipeline), and `getTopologyKey`.
3. **UI** — `registerEffectLayerUi(type, { Icon, Panel })`
   (`@/effects/effect-layer`). Keeps the runtime/store React-free; the sidebar and
   layers list read `addon.Panel` / `addon.Icon` from the registry.

Built-in UI is wired in `src/components/sidebar/panels/register-builtin-panels.tsx`,
imported once from `App.tsx`.

## Hard invariant: transient editing (Direct vs Manifest)

Dragging a slider/color must update the scene every frame **and** collapse to one
undo entry. Panels wrap a drag in `beginHistoryTransaction()` /
`commitHistoryTransaction()` and pass `{ history: "skip" }` to the update action.

`runtime.getTopologyKey` (and the runtime adapter's `getTopologyKey`) MUST depend
only on **structural** facts (stop/anchor counts, `enabled`, geometry) — never on a
continuously-tweaked value. If a drag changed the topology key, `EditorSkyboxSync`
would fall back to a full `setManifest` rebuild and break live tuning. The
acceptance test (`src/effects/add-layer-acceptance.test.ts`) asserts a param tweak
keeps the topology key stable.
