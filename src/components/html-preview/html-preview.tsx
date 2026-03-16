import { type ReactNode, useMemo } from "react";
import PreviewBase from "./preview-base";
import { dedent } from "@/utils/dedent";
import { preflightCss } from "./preflight";

interface HtmlPreviewProps {
  html: string;
  css?: string;
  title?: string;
  height?: number;
  defaultOpen?: boolean;
}

function buildSrcdoc(html: string, css?: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${preflightCss}</style>
<style>html, body { height: 100%; }</style>
${css ? `<style>${css}</style>` : ""}
</head>
<body>${html}</body>
</html>`;
}

export default function HtmlPreview({
  html,
  css,
  title,
  height,
  defaultOpen,
}: HtmlPreviewProps): ReactNode {
  const srcdoc = useMemo(() => buildSrcdoc(html, css), [html, css]);

  return (
    <PreviewBase
      title={title}
      height={height}
      srcdoc={srcdoc}
      defaultOpen={defaultOpen}
      sandbox="allow-same-origin"
      syncDelay={0}
      codeBlocks={[
        { language: "html", title: "HTML", code: dedent(html) },
        ...(css
          ? [{ language: "css", title: "CSS", code: dedent(css) }]
          : []),
      ]}
    />
  );
}
