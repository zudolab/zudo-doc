import type { ColorScheme } from "../color-schemes";
import { draculaNordTokyoVariations } from "./dracula-nord-tokyo";
import { catppuccinRosepineVariations } from "./catppuccin-rosepine";
import { solarizedMaterialVariations } from "./solarized-material";
import { gruvboxEverforestKanagawaVariations } from "./gruvbox-everforest-kanagawa";
import { monokaiAyuGithubFoxVariations } from "./monokai-ayu-github-fox";

/** All color scheme variations (V0=dimmest, V5≈original, V9=highest contrast) */
export const colorSchemeVariations: Record<string, ColorScheme> = {
  ...draculaNordTokyoVariations,
  ...catppuccinRosepineVariations,
  ...solarizedMaterialVariations,
  ...gruvboxEverforestKanagawaVariations,
  ...monokaiAyuGithubFoxVariations,
};
