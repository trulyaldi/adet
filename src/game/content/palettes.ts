// One limited palette per biome (16–24 colours), named by ramp. The art
// generator paints with these; the renderer reads a few for sky, UI tints and
// light. Every ramp runs dark → light. `outline` is each biome's hue-shifted
// near-black: every sprite in a biome shares it.

import type { BiomeId } from '../../domain/game/biomes';

export interface BiomePalette {
  outline: string;
  /** Sky gradient, top → horizon. */
  sky: [string, string];
  /** Far, mid and near parallax silhouettes. */
  layers: [string, string, string];
  ground: [string, string, string, string];
  path: [string, string, string];
  foliage: [string, string, string];
  trunk: [string, string];
  rock: [string, string, string];
  /** Water, lava or crystal: the biome's animated liquid/glow. */
  liquid: [string, string, string];
  /** Two accent ramps for mobs and decor. */
  accentA: [string, string, string];
  accentB: [string, string, string];
  /** Warm light (torches, fireflies, glow sprites). */
  light: string;
  /** The HUD/UI tint for this biome's panels. */
  ui: string;
}

export const PALETTES: Record<BiomeId, BiomePalette> = {
  forest: {
    outline: '#1d2a24',
    sky: ['#8fcfc4', '#f3e2b2'],
    layers: ['#7fb3a0', '#4f8a64', '#2f5f42'],
    ground: ['#2f5a3a', '#3f7a45', '#5a9a4e', '#8cc265'],
    path: ['#7a5c3a', '#a07c4e', '#c9a46c'],
    foliage: ['#1f4a33', '#3a7a44', '#6fae55'],
    trunk: ['#4a3325', '#74502f'],
    rock: ['#4d5566', '#6f798b', '#a0a9b8'],
    liquid: ['#2f6f8f', '#4d9dbd', '#a2e2ea'],
    accentA: ['#b8434f', '#e86a7a', '#f7b0b0'],
    accentB: ['#c98a2a', '#f2c45a', '#fbeeb0'],
    light: '#ffe9a8',
    ui: '#3f7a45',
  },
  swamp: {
    outline: '#15171f',
    sky: ['#3f4e6a', '#8a7aa6'],
    layers: ['#5a5f86', '#3d4f5e', '#26383a'],
    ground: ['#263532', '#35504a', '#4f6e62', '#77967f'],
    path: ['#3f3528', '#5c4b35', '#7c6749'],
    foliage: ['#223c30', '#355f47', '#57875f'],
    trunk: ['#2f2a2c', '#4a4043'],
    rock: ['#3a3f4c', '#565d6e', '#7c8496'],
    liquid: ['#1c3940', '#2c5f60', '#6fb3a2'],
    accentA: ['#3b2a4a', '#6a4f86', '#a58cc4'],
    accentB: ['#c98a3a', '#f3c86a', '#fff0b8'],
    light: '#f7d77f',
    ui: '#35504a',
  },
  desert: {
    outline: '#2a1a1c',
    sky: ['#1f3f8f', '#f2c38a'],
    layers: ['#7a5a8f', '#c07a58', '#d99a5e'],
    ground: ['#b8753f', '#d49a52', '#e8bb6e', '#f5dca0'],
    path: ['#a8683a', '#c98a4e', '#e3ad6a'],
    foliage: ['#2f6a4f', '#4a8f5e', '#7cbd72'],
    trunk: ['#6a4630', '#8f6240'],
    rock: ['#7a4a33', '#9c6541', '#c18654'],
    liquid: ['#2d7fa8', '#4fb0d0', '#a8e6f0'],
    accentA: ['#a8403a', '#e8766a', '#f7b3a0'],
    accentB: ['#3a5fa8', '#5f8fd8', '#b8d2f5'],
    light: '#fff0c0',
    ui: '#b8753f',
  },
  frost: {
    outline: '#1c2233',
    sky: ['#9bbbe8', '#f5c3cf'],
    layers: ['#c3cfe8', '#8ea6c8', '#5f7aa0'],
    ground: ['#9fb0d0', '#c3d0e8', '#e3ebf7', '#ffffff'],
    path: ['#6f84ae', '#95a8cc', '#b8c6e2'],
    foliage: ['#1f4a4a', '#2f6a63', '#4c8c7c'],
    trunk: ['#3f3440', '#5f4f5c'],
    rock: ['#505a73', '#6f7b96', '#98a4bf'],
    liquid: ['#3f6fa8', '#6fa8d8', '#c8ecff'],
    accentA: ['#b8607a', '#e8a3b8', '#f8d8e2'],
    accentB: ['#4fb89a', '#7ff0c0', '#d0fff0'],
    light: '#fff3e0',
    ui: '#5f7aa0',
  },
  iron: {
    outline: '#1d1b22',
    sky: ['#8fa8c8', '#e3e0e6'],
    layers: ['#a6aec2', '#7c8296', '#555a6c'],
    ground: ['#3f6a3f', '#557f49', '#6f9a58', '#9cc078'],
    path: ['#5a5b67', '#7c7e8c', '#a2a4b2'],
    foliage: ['#2f5a3a', '#4a7a44', '#77a55e'],
    trunk: ['#5a3d2a', '#7d5638'],
    rock: ['#4a4b57', '#6c6e7c', '#9fa1af'],
    liquid: ['#2f5f8a', '#4d86b3', '#a0d0ea'],
    accentA: ['#7a1f2b', '#b8323d', '#e46a62'],
    accentB: ['#a8741f', '#dca83a', '#f7d77a'],
    light: '#ffd27a',
    ui: '#7a1f2b',
  },
  volcano: {
    outline: '#120d10',
    sky: ['#2a1418', '#7a321c'],
    layers: ['#4a2226', '#351a1f', '#221316'],
    ground: ['#221c21', '#322a30', '#463b41', '#635459'],
    path: ['#3f3436', '#5a4b4c', '#7a6866'],
    foliage: ['#3a2a2a', '#5a3f35', '#7a5a45'],
    trunk: ['#221a1c', '#3a2c2c'],
    rock: ['#2f282e', '#4a3f44', '#6f6066'],
    liquid: ['#b02a12', '#ff6a1f', '#ffd35a'],
    accentA: ['#8a1f12', '#d6461c', '#ff8a3a'],
    accentB: ['#7a3fa0', '#b56ad6', '#e6b0f5'],
    light: '#ffb45a',
    ui: '#8a1f12',
  },
  astral: {
    outline: '#0e0c1f',
    sky: ['#0b0a24', '#35286e'],
    layers: ['#2a2260', '#1f1a4a', '#16123a'],
    ground: ['#2a2550', '#3d3673', '#574f99', '#7d74c2'],
    path: ['#4a4290', '#6a60b8', '#958be0'],
    foliage: ['#1f5a78', '#2f86a0', '#5fc0d0'],
    trunk: ['#2a2450', '#3f3670'],
    rock: ['#262048', '#3a3268', '#5a5090'],
    liquid: ['#1f8fa8', '#4fd0e0', '#d8ffff'],
    accentA: ['#8a5fd0', '#c090f5', '#f0dcff'],
    accentB: ['#c8a040', '#f0d070', '#fff6c8'],
    light: '#c8f6ff',
    ui: '#3d3673',
  },
};

/** Shared (UI, avatar, NPCs, props) palette: warm, neutral, readable on every biome. */
export const SHARED = {
  outline: '#1c1a24',
  skin: ['#8a5a3c', '#c98f63', '#f0c39a'] as [string, string, string],
  hair: ['#2a1c18', '#4a3024', '#6f4a34'] as [string, string, string],
  cloth: ['#3a3f5a', '#545c80', '#7c86aa'] as [string, string, string],
  leather: ['#4a2f22', '#6f4630', '#9a6a44'] as [string, string, string],
  metal: ['#5a6070', '#8a92a4', '#c8cedb'] as [string, string, string],
  gold: ['#9a6a1a', '#d9a53a', '#f7da7a'] as [string, string, string],
  red: ['#7a2230', '#b83a44', '#e8706a'] as [string, string, string],
  green: ['#2f5a3a', '#4a8a4e', '#86c070'] as [string, string, string],
  blue: ['#24406a', '#3a6aa8', '#7ab0e0'] as [string, string, string],
  purple: ['#3f2a5a', '#6a4a96', '#a88ad0'] as [string, string, string],
  white: '#f5f1e6',
  paper: ['#b89a70', '#dcc59a', '#f3e6c4'] as [string, string, string],
  wood: ['#4a3024', '#74502f', '#a07a4a'] as [string, string, string],
  fire: ['#c8401a', '#ff8a2a', '#ffd35a', '#fff6c0'] as [string, string, string, string],
  shadow: '#000000',
};
