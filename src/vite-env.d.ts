/// <reference types="vite/client" />

declare module "color-blend/unit" {
  export type RGBA = {
    a: number;
    b: number;
    g: number;
    r: number;
  };

  export function normal(backdrop: RGBA, source: RGBA): RGBA;
  export function multiply(backdrop: RGBA, source: RGBA): RGBA;
  export function screen(backdrop: RGBA, source: RGBA): RGBA;
  export function overlay(backdrop: RGBA, source: RGBA): RGBA;
  export function darken(backdrop: RGBA, source: RGBA): RGBA;
  export function lighten(backdrop: RGBA, source: RGBA): RGBA;
  export function colorDodge(backdrop: RGBA, source: RGBA): RGBA;
  export function colorBurn(backdrop: RGBA, source: RGBA): RGBA;
  export function hardLight(backdrop: RGBA, source: RGBA): RGBA;
  export function softLight(backdrop: RGBA, source: RGBA): RGBA;
  export function difference(backdrop: RGBA, source: RGBA): RGBA;
  export function exclusion(backdrop: RGBA, source: RGBA): RGBA;
}
