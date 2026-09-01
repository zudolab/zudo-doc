const MIN_PREVIEW_HEIGHT = 200;
const PREVIEW_HEIGHT_BUFFER = 16;
const SELF_SIZING_EPSILON = 1;

interface PreviewAutoHeightRuntime {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
}

export interface PreviewAutoHeightOptions {
  iframe: HTMLIFrameElement;
  syncDelay: number;
  getCurrentHeight: () => number;
  setHeight: (height: number) => void;
  runtime?: PreviewAutoHeightRuntime;
}

export interface PreviewAutoHeightController {
  handleLoad(): void;
  schedule(): void;
  destroy(): void;
}

function defaultRuntime(iframe: HTMLIFrameElement): PreviewAutoHeightRuntime {
  // Resize observation belongs to the iframe realm, but scheduling belongs to
  // the parent realm: the callback mutates the parent-owned iframe element and
  // Preact state, so it should coalesce with the parent's layout/paint cycle.
  const view = iframe.ownerDocument.defaultView ?? window;
  return {
    setTimeout: (callback, delay) => view.setTimeout(callback, delay),
    clearTimeout: (id) => view.clearTimeout(id),
    requestAnimationFrame: (callback) => view.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => view.cancelAnimationFrame(id),
  };
}

/**
 * Owns the readable-iframe auto-height lifecycle. Kept separate from Preact so
 * reload generations, observer callbacks, and teardown remain deterministic.
 */
export function createPreviewAutoHeightController({
  iframe,
  syncDelay,
  getCurrentHeight,
  setHeight,
  runtime = defaultRuntime(iframe),
}: PreviewAutoHeightOptions): PreviewAutoHeightController {
  let generation = 0;
  let document: Document | null = null;
  let observer: ResizeObserver | null = null;
  let timeoutId: number | null = null;
  let frameId: number | null = null;
  let lastAppliedHeight = getCurrentHeight();
  let lastWriteSample:
    | { bodyHeight: number; currentHeight: number; targetHeight: number }
    | undefined;
  let destroyed = false;

  const cancelPending = () => {
    observer?.disconnect();
    observer = null;
    if (timeoutId != null) {
      runtime.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (frameId != null) {
      runtime.cancelAnimationFrame(frameId);
      frameId = null;
    }
    document = null;
  };

  const measure = (expectedGeneration: number) => {
    if (destroyed || expectedGeneration !== generation || !document?.body) {
      return;
    }

    const bodyHeight = document.body.scrollHeight;
    if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) return;

    const currentHeight = getCurrentHeight();
    const targetHeight = Math.max(
      bodyHeight + PREVIEW_HEIGHT_BUFFER,
      MIN_PREVIEW_HEIGHT,
    );

    // A body sized from the iframe viewport (100vh/100%) reports the height
    // we just applied. Adding the buffer again would increase forever, one
    // observer delivery at a time. Hold the current height in that case while
    // still allowing genuine increase and decrease measurements through.
    const isSelfSizingGrowth =
      targetHeight > currentHeight &&
      Math.abs(bodyHeight - currentHeight) <= SELF_SIZING_EPSILON;
    const followedPreviousWrite =
      targetHeight > currentHeight &&
      lastWriteSample != null &&
      Math.abs(currentHeight - lastWriteSample.targetHeight) <=
        SELF_SIZING_EPSILON &&
      Math.abs(
        (bodyHeight - lastWriteSample.bodyHeight) -
          (currentHeight - lastWriteSample.currentHeight),
      ) <= SELF_SIZING_EPSILON;
    if (
      isSelfSizingGrowth ||
      followedPreviousWrite ||
      targetHeight === lastAppliedHeight
    ) {
      return;
    }

    lastAppliedHeight = targetHeight;
    lastWriteSample = { bodyHeight, currentHeight, targetHeight };
    setHeight(targetHeight);
  };

  const scheduleFor = (expectedGeneration: number) => {
    if (
      destroyed ||
      expectedGeneration !== generation ||
      document == null ||
      frameId != null
    ) {
      return;
    }
    frameId = runtime.requestAnimationFrame(() => {
      frameId = null;
      measure(expectedGeneration);
    });
  };

  const handleLoad = () => {
    generation += 1;
    cancelPending();
    if (destroyed) return;
    const expectedGeneration = generation;
    lastAppliedHeight = getCurrentHeight();
    lastWriteSample = undefined;

    try {
      const nextDocument = iframe.contentDocument;
      if (!nextDocument?.body) return;
      // Accessing body is the same-origin probe. Opaque sandboxed documents
      // throw here in browsers even when contentDocument itself is non-null.
      void nextDocument.body.scrollHeight;
      document = nextDocument;
    } catch {
      return;
    }

    measure(expectedGeneration);

    if (syncDelay > 0) {
      timeoutId = runtime.setTimeout(() => {
        timeoutId = null;
        scheduleFor(expectedGeneration);
      }, syncDelay);
    }

    const iframeWindow = iframe.contentWindow as
      | (Window & { ResizeObserver?: typeof ResizeObserver })
      | null;
    const ResizeObserverConstructor = iframeWindow?.ResizeObserver;
    if (ResizeObserverConstructor) {
      const nextObserver = new ResizeObserverConstructor(() => {
        scheduleFor(expectedGeneration);
      });
      observer = nextObserver;
      nextObserver.observe(document.body);
      if (document.documentElement !== document.body) {
        nextObserver.observe(document.documentElement);
      }
    }
  };

  return {
    handleLoad,
    schedule: () => scheduleFor(generation),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      cancelPending();
    },
  };
}
