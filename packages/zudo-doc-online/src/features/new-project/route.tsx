/**
 * The `#/new` route: the C3 gallery-first creation wizard (#3351, epic
 * #3345). The theme gallery IS the flow — a full-width grid of every
 * catalog pack painted from its `meta.preview` swatches, with a slim finish
 * sheet (name + default mode + create) on the right.
 *
 * v1 collects exactly name + theme pack + default mode. Deliberately absent
 * (epic reality adaptations): accent-hue row, feature checkboxes, preset
 * JSON affordance, fake URLs.
 *
 * The `@takazudo/zudo-doc/catalog` import is the ONE authorized framework
 * import in this package (epic #3345 contract 3) — data only, browser-safe;
 * no framework component or CSS is imported.
 *
 * Slug reconciliation: the slug chip under the name field is a client-side
 * preview from the shared `core/outline/slugs.ts` derivation; the server's
 * derived slug is authoritative. Duplicate titles succeed (the server
 * suffixes `-2`, `-3`, …) and navigation follows whatever slug the created
 * snapshot reports.
 */

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import catalog, { type ThemePackMeta } from "@takazudo/zudo-doc/catalog";
import { formatRoute, navigateTo, type Route } from "../../app/router.js";
import { deriveSlug } from "../../core/outline/slugs.js";
import type {
  ProjectPreset,
  ProjectsDirectoryStore,
} from "../../store/projects-directory.js";
import { createHttpProjectsDirectoryStore } from "../../store/projects-http-provider.js";
import {
  readColorSchemeFromDom,
  subscribeColorSchemeChanged,
  type ColorSchemeMode,
} from "../../theme/color-scheme-sync.js";
import { isImeKeyEvent, useCompositionGuard } from "../editor/ime.js";
import { PackMini, packStyleVars } from "./pack-preview.js";
import "./wizard.css";

type DefaultMode = NonNullable<ProjectPreset["defaultMode"]>;
type PackFilter = "all" | ColorSchemeMode;

type CreateState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "error"; message: string };

const DEFAULT_PACK_SLUG = "default";

const BACK_LINK =
  "inline-flex items-center gap-hsp-xs text-small text-muted hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const FILTER_CHIP =
  "rounded-full border border-border bg-surface px-hsp-md py-vsp-2xs text-small text-fg-mild hover:border-border-strong hover:text-fg aria-[pressed=true]:border-accent aria-[pressed=true]:bg-accent-soft aria-[pressed=true]:text-fg focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const PACK_CARD =
  "relative flex flex-col overflow-hidden rounded-md border border-border bg-surface text-left hover:border-border-strong hover:shadow-[var(--shadow-2)] aria-[pressed=true]:border-accent aria-[pressed=true]:shadow-[var(--shadow-1)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const SEG_BUTTON =
  "rounded-sm py-vsp-2xs text-small text-muted hover:text-fg aria-[pressed=true]:bg-bg aria-[pressed=true]:font-medium aria-[pressed=true]:text-fg aria-[pressed=true]:shadow-[var(--shadow-1)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const NAME_INPUT =
  "w-full rounded-md border border-border-strong bg-bg px-hsp-md py-vsp-xs text-body text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const CREATE_BUTTON =
  "inline-flex w-full items-center justify-center gap-hsp-sm rounded-md bg-accent px-hsp-lg py-vsp-xs text-body font-semibold text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const FIELD_LABEL =
  "mb-vsp-2xs block font-mono text-caption uppercase tracking-[0.08em] text-muted";

const MODE_OPTIONS: readonly DefaultMode[] = ["light", "dark", "system"];
const MODE_LABELS: Record<DefaultMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** The app's live color scheme — picks which `meta.preview` mode paints the cards. */
function useAppColorScheme(): ColorSchemeMode {
  const [mode, setMode] = useState<ColorSchemeMode>(() =>
    readColorSchemeFromDom("light"),
  );
  useEffect(
    () =>
      subscribeColorSchemeChanged(() => {
        setMode(readColorSchemeFromDom("light"));
      }),
    [],
  );
  return mode;
}

export interface NewProjectRouteProps {
  /** Test seam — defaults to the real HTTP directory store. */
  store?: ProjectsDirectoryStore;
  /** Test seam — defaults to the full generated catalog (all 31 packs). */
  packs?: ThemePackMeta[];
  /** Test seam — defaults to the hash router's `navigateTo`. */
  navigate?: (route: Route) => void;
}

export default function NewProjectRoute({
  store,
  packs = catalog.packs,
  navigate = navigateTo,
}: NewProjectRouteProps = {}) {
  const directory = useMemo(
    () => store ?? createHttpProjectsDirectoryStore(),
    [store],
  );
  const appMode = useAppColorScheme();

  const [selectedSlug, setSelectedSlug] = useState<string>(DEFAULT_PACK_SLUG);
  const [title, setTitle] = useState("");
  const [defaultMode, setDefaultMode] = useState<DefaultMode>("system");
  const [filter, setFilter] = useState<PackFilter>("all");
  const [createState, setCreateState] = useState<CreateState>({ status: "idle" });

  const selectedPack =
    packs.find((pack) => pack.slug === selectedSlug) ?? packs[0];

  const nameRef = useRef<HTMLInputElement>(null);
  const isComposing = useCompositionGuard(nameRef, (value) => setTitle(value));
  const busyRef = useRef(false);
  busyRef.current = createState.status === "busy";

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Esc anywhere returns to the dashboard — unless an IME owns the key or a
  // create request is already in flight (navigating away mid-create would
  // orphan the busy state).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isImeKeyEvent(event, false)) return;
      if (busyRef.current) return;
      navigate({ name: "projects" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  const trimmedTitle = title.trim();
  const slugPreview = deriveSlug(trimmedTitle);
  const visiblePacks = packs.filter(
    (pack) => filter === "all" || pack.mode === filter,
  );

  async function create(): Promise<void> {
    if (busyRef.current || trimmedTitle.length === 0 || !selectedPack) return;
    // Set the ref synchronously, not just via the render-time sync — a second
    // click (or Enter) landing before the busy re-render must not double-fire.
    busyRef.current = true;
    setCreateState({ status: "busy" });
    try {
      const snapshot = await directory.createProject(trimmedTitle, {
        schemaVersion: 1,
        themePack: selectedPack.slug,
        defaultMode,
      });
      // The server's derived slug is authoritative — follow it verbatim.
      navigate({ name: "outline", projectSlug: snapshot.slug });
    } catch (error) {
      setCreateState({
        status: "error",
        message:
          error instanceof Error && error.message.length > 0
            ? error.message
            : "The project could not be created. Is the editing server running?",
      });
    }
  }

  function onNameKeyDown(event: KeyboardEvent): void {
    if (isImeKeyEvent(event, isComposing())) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void create();
    }
  }

  if (!selectedPack) {
    return (
      <section className="flex h-full min-h-[0px] flex-col px-hsp-2xl py-vsp-lg">
        <p role="alert" className="text-body text-danger">
          The theme catalog is empty — the app build is broken.
        </p>
      </section>
    );
  }

  return (
    <section className="grid h-full min-h-[0px] grid-cols-[minmax(0,1fr)_400px]">
      {/* ============ gallery: the flow ============ */}
      {/* A <section>, not <main> — the shell already provides the page's
          single <main> landmark around every routed surface. */}
      <section
        aria-label="Theme gallery"
        className="flex min-h-[0px] flex-col overflow-y-auto px-hsp-2xl pb-vsp-2xl"
      >
        <div className="max-w-[900px] pt-vsp-xl pb-vsp-lg">
          <p className="flex items-center gap-hsp-sm font-mono text-caption uppercase tracking-[0.08em] text-muted">
            <a href={formatRoute({ name: "projects" })} className={BACK_LINK}>
              <span aria-hidden="true">←</span> Projects
            </a>
            <span aria-hidden="true">/</span>
            <span>New project</span>
          </p>
          <h1 className="mt-vsp-md text-heading font-semibold text-fg">
            Pick a look.{" "}
            <span className="font-normal text-muted">
              Everything else takes a minute.
            </span>
          </h1>
          <p className="mt-vsp-sm max-w-[58ch] text-body text-fg-mild">
            Every pack sets typography, color and layout for the whole site.{" "}
            <b className="font-semibold text-fg">You can switch packs later</b>{" "}
            — nothing you choose here is permanent, and none of it touches your
            content.
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter theme packs"
          className="zdo-wiz-gallerybar flex items-center gap-hsp-sm border-b border-border bg-bg py-vsp-sm"
        >
          {(["all", "light", "dark"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              className={FILTER_CHIP}
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : option === "light" ? "Light" : "Dark"}
            </button>
          ))}
          <span className="ml-auto font-mono text-caption text-muted">
            {visiblePacks.length} of {packs.length} shown
          </span>
        </div>

        <div className="grid grid-cols-3 gap-hsp-lg pt-vsp-lg">
          {visiblePacks.map((pack) => (
            <button
              key={pack.slug}
              type="button"
              data-pack={pack.slug}
              aria-pressed={pack.slug === selectedPack.slug}
              aria-label={`Theme pack ${pack.name}`}
              style={packStyleVars(pack, appMode)}
              className={PACK_CARD}
              onClick={() => {
                setSelectedSlug(pack.slug);
              }}
            >
              <span className="zdo-wiz-thumb">
                {pack.mode === "dark" ? (
                  <span className="zdo-wiz-modetag">Dark</span>
                ) : null}
                <span className="zdo-wiz-check">
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                    style={{ width: "var(--icon-xs)", height: "var(--icon-xs)" }}
                  >
                    <path
                      d="M2.5 6.2 4.9 8.6 9.6 3.8"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <PackMini pack={pack} />
              </span>
              <span className="flex items-start gap-hsp-md px-hsp-md py-vsp-sm">
                <span className="block min-w-[0px]">
                  <span className="zdo-wiz-packname block text-body font-semibold text-fg">
                    {pack.name}
                  </span>
                  <span className="zdo-wiz-desc mt-vsp-2xs block text-caption text-muted">
                    {pack.description}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ============ finish sheet ============ */}
      <aside
        aria-label="Finish setup"
        className="zdo-wiz-sheet flex min-h-[0px] flex-col border-l border-border bg-surface"
      >
        <div className="min-h-[0px] flex-1 overflow-y-auto px-hsp-lg py-vsp-md">
          <div className="flex items-baseline gap-hsp-sm pb-vsp-sm">
            <h2 className="text-body font-semibold text-fg">Finish up</h2>
            <span className="ml-auto font-mono text-caption uppercase tracking-[0.08em] text-muted">
              Selected
            </span>
          </div>

          <span
            key={selectedPack.slug}
            className="zdo-wiz-preview"
            style={packStyleVars(selectedPack, appMode)}
            data-selected-pack={selectedPack.slug}
          >
            <PackMini pack={selectedPack} />
          </span>
          <p className="flex items-baseline gap-hsp-sm pt-vsp-xs pb-vsp-md">
            <strong className="text-body font-semibold text-fg">
              {selectedPack.name}
            </strong>
            <code className="ml-auto rounded-sm bg-surface-2 px-hsp-xs font-mono text-caption text-muted">
              {selectedPack.mode}-first
            </code>
          </p>

          <div className="pb-vsp-md">
            <label htmlFor="new-project-name" className={FIELD_LABEL}>
              Project name
            </label>
            <input
              ref={nameRef}
              id="new-project-name"
              type="text"
              autoComplete="off"
              spellcheck={false}
              placeholder="My documentation"
              value={title}
              className={NAME_INPUT}
              onInput={(event) => setTitle(event.currentTarget.value)}
              onKeyDown={onNameKeyDown}
            />
            <p className="mt-vsp-2xs flex items-center gap-hsp-xs font-mono text-caption text-muted">
              <span
                aria-hidden="true"
                className="size-(--icon-xs) rounded-full bg-success"
              />
              <b data-slug-preview className="font-semibold text-fg-mild">
                {slugPreview}
              </b>
            </p>
            <p className="mt-vsp-2xs text-caption text-muted">
              The server finalizes the slug — a duplicate name gets a numbered
              suffix.
            </p>
          </div>

          <div className="pb-vsp-md">
            <span id="new-project-mode-label" className={FIELD_LABEL}>
              Default mode
            </span>
            <div
              role="group"
              aria-labelledby="new-project-mode-label"
              className="grid grid-cols-3 gap-hsp-2xs rounded-md border border-border bg-surface-2 p-hsp-2xs"
            >
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  data-mode={option}
                  aria-pressed={defaultMode === option}
                  className={SEG_BUTTON}
                  onClick={() => setDefaultMode(option)}
                >
                  {MODE_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          {createState.status === "error" ? (
            <p role="alert" className="pb-vsp-sm text-small text-danger">
              {createState.message}
            </p>
          ) : null}
        </div>

        <div className="flex-none border-t border-border px-hsp-lg py-vsp-md">
          <button
            type="button"
            className={CREATE_BUTTON}
            disabled={createState.status === "busy" || trimmedTitle.length === 0}
            onClick={() => void create()}
          >
            {createState.status === "busy" ? (
              <>
                <span className="zdo-wiz-spinner" aria-hidden="true" />
                Creating {slugPreview}…
              </>
            ) : (
              "Create project"
            )}
          </button>
          <p className="mt-vsp-2xs text-center text-caption text-muted">
            Nothing is saved until you create.
          </p>
        </div>
      </aside>
    </section>
  );
}
