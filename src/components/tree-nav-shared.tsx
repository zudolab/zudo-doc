// Shared constants and primitives for sidebar-tree and site-tree-nav

// Indentation — fluid clamp values
export const INDENT = "clamp(0.8rem, 1.2vw, 1.625rem)";
export const CONNECTOR_OFFSET = "clamp(0.2rem, 0.3vw, 0.5rem)";
export const CONNECTOR_WIDTH = "clamp(0.4rem, 0.6vw, 1rem)";
export const BASE_PAD = "clamp(0.4rem, 0.8vw, 1.3rem)";

export function connectorLeft(depth: number): string {
  return `calc(${depth} * ${INDENT} + ${CONNECTOR_OFFSET})`;
}

export function ConnectorLines({ depth, isLast, widthScale = 1 }: { depth: number; isLast: boolean; widthScale?: number }) {
  if (depth === 0) return null;
  const left = connectorLeft(depth);
  const width = widthScale === 1 ? CONNECTOR_WIDTH : `calc(${CONNECTOR_WIDTH} * ${widthScale})`;
  return (
    <>
      <div
        className="absolute border-l border-dashed border-muted"
        style={{
          left,
          top: 0,
          bottom: isLast ? "50%" : 0,
        }}
      />
      <div
        className="absolute border-t border-dashed border-muted"
        style={{
          left,
          width,
          top: "50%",
        }}
      />
    </>
  );
}
