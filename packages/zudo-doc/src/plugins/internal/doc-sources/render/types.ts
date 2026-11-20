export interface RenderedPage {
  title: string;
  description: string;
  body: string;
}

export type Warn = (message: string) => void;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
