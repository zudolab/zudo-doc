/** Safe, serializable production-renderer output. Only the preparation helper creates it. */
export type IntroNode = string | {
  tag: string;
  attrs: Record<string, string | boolean>;
  children: IntroNode[];
};
export interface PreparedHomeIntro {
  nodes: IntroNode[];
}
export type PreparedHomeIntros = Record<string, PreparedHomeIntro | null>;
