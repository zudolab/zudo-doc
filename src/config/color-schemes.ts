/** A color reference: palette index (number) or direct color value (string) */
export type ColorRef = number | string;

export interface ColorScheme {
  background: ColorRef;
  foreground: ColorRef;
  cursor: ColorRef;
  selectionBg: ColorRef;
  selectionFg: ColorRef;
  palette: [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
  shikiTheme: NonNullable<import("astro").ShikiConfig["theme"]>;
  /** Optional semantic overrides — when omitted, defaults are used:
   *  surface=palette[0], muted=palette[8], accent=palette[6], accentHover=palette[14]
   *  codeBg=foreground, codeFg=background, success=palette[2], danger=palette[1],
   *  warning=palette[3], info=palette[4]
   *  Each field accepts a palette index (number) or a direct color value (string). */
  semantic?: {
    surface?: ColorRef;
    muted?: ColorRef;
    accent?: ColorRef;
    accentHover?: ColorRef;
    codeBg?: ColorRef;
    codeFg?: ColorRef;
    success?: ColorRef;
    danger?: ColorRef;
    warning?: ColorRef;
    info?: ColorRef;
  };
}

export const colorSchemes: Record<string, ColorScheme> = {
  "Default Light": {
    background: 1,
    foreground: 0,
    cursor: 6,
    selectionBg: 10,
    selectionFg: 9,
    palette: [
      "#303030", "#e2ddda", "#266538", "#7a5218",
      "#3277c8", "#a35e0f", "#90a1b9", "#a83838",
      "#6b6b6b", "#ece9e9", "#303030", "#654516",
      "#5b99dc", "#b89ee7", "#8590a0", "#dd3131",
    ],
    shikiTheme: "catppuccin-latte",
    semantic: {
      surface: 9,
      muted: 8,
      accent: 5,
      accentHover: 14,
      codeBg: 9,
      codeFg: 10,
      success: 2,
      danger: 15,
      warning: 7,
      info: 4,
    },
  },
  "Default Dark": {
    background: 9,
    foreground: 15,
    cursor: 6,
    selectionBg: 10,
    selectionFg: 11,
    palette: [
      "#1c1c1c", "#da6871", "#93bb77", "#dfbb77",
      "#5caae9", "#c074d6", "#90a1b9", "#a0a0a0",
      "#888888", "#181818", "#383838", "#e0e0e0",
      "#d69a66", "#c074d6", "#a7c0e3", "#b8b8b8",
    ],
    shikiTheme: "vitesse-dark",
    semantic: {
      surface: 0,
      muted: 8,
      accent: 12,
      accentHover: 14,
      codeBg: 10,
      codeFg: 11,
      success: 2,
      danger: 1,
      warning: 3,
      info: 4,
    },
  },
};
