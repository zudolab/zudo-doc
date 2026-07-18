import type {
  HighlightCodeOptions,
  HighlightCodeResult,
} from "@takazudo/zfb-md-wasm";

type HighlightModule = Pick<
  typeof import("@takazudo/zfb-md-wasm"),
  "highlightCode"
>;

export type HighlightModuleImporter = () => Promise<HighlightModule>;

export interface HtmlPreviewHighlightRuntime {
  highlightCode(
    code: string,
    options: HighlightCodeOptions,
  ): Promise<HighlightCodeResult>;
}

/**
 * Build the HTML Preview's lazy zfb highlighting adapter.
 *
 * The cached value is only the public package-root module import. A rejected
 * import is evicted so a later source-panel mount can retry a transient chunk
 * load. Calls to `highlightCode` are deliberately not cached: the upstream
 * package owns WASM initialization and trap recovery, while the component owns
 * request cancellation and stale-result protection.
 */
export function createHighlightRuntime(
  importModule: HighlightModuleImporter,
): HtmlPreviewHighlightRuntime {
  let modulePromise: Promise<HighlightModule> | null = null;

  function loadModule(): Promise<HighlightModule> {
    if (!modulePromise) {
      const pending = importModule().catch((error: unknown) => {
        if (modulePromise === pending) {
          modulePromise = null;
        }
        throw error;
      });
      modulePromise = pending;
    }
    return modulePromise;
  }

  return {
    async highlightCode(code, options) {
      const { highlightCode } = await loadModule();
      return highlightCode(code, options);
    },
  };
}

const defaultRuntime = createHighlightRuntime(
  () => import("@takazudo/zfb-md-wasm"),
);

/**
 * Return markup only when zfb produced a usable result.
 *
 * An unknown non-empty language is a supported outcome: zfb returns safely
 * escaped `hi-root` markup plus a warning. Error diagnostics and `html: null`
 * represent invalid options/internal failure and must retain the JSX-escaped
 * fallback instead.
 */
export function getUsableHighlightHtml(
  result: HighlightCodeResult,
): string | null {
  if (
    result.html == null ||
    result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
  ) {
    return null;
  }
  return result.html;
}

export interface HighlightRequestOptions {
  code: string;
  language: string;
  onSettled: (html: string | null) => void;
  runtime?: HtmlPreviewHighlightRuntime;
}

/**
 * Start one highlight request and return its effect cleanup.
 *
 * Rejections are expected at this boundary (missing optional peer, resource
 * load failure, or a current-call WASM trap). They resolve the UI to its plain
 * fallback. Cleanup suppresses both successful and failed late completions.
 */
export function startHighlightRequest({
  code,
  language,
  onSettled,
  runtime = defaultRuntime,
}: HighlightRequestOptions): () => void {
  let cancelled = false;

  void Promise.resolve()
    .then(() => runtime.highlightCode(code, { language }))
    .then(
      (result) => {
        if (!cancelled) {
          onSettled(getUsableHighlightHtml(result));
        }
      },
      () => {
        if (!cancelled) {
          onSettled(null);
        }
      },
    );

  return () => {
    cancelled = true;
  };
}
