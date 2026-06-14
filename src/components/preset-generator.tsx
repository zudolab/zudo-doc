"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "preact/hooks";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import {
  FEATURES,
  buildJson,
  buildCliCommand,
  DEFAULT_HEADER_RIGHT_ITEMS,
  INITIAL_HEADER_RIGHT_ITEMS,
  DEFAULT_META_TAGS,
  SINGLE_SCHEMES,
  LIGHT_SCHEMES,
  SUPPORTED_LANGS,
  HEADER_RIGHT_LABELS,
  type FormState,
  type HeaderRightItemSpec,
} from "../lib/preset-generator-logic";
import { HeadingH3 } from "@takazudo/zudo-doc/content";

// ── Data ──

const DARK_SCHEMES = SINGLE_SCHEMES.filter(
  (s) => !(LIGHT_SCHEMES as readonly string[]).includes(s),
);

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

function headerRightItemKey(item: HeaderRightItemSpec): string {
  return `${item.kind}:${item.name}`;
}

// ── Sub-components ──

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <HeadingH3 className="mb-vsp-xs">
      {children}
    </HeadingH3>
  );
}

function HeaderRightItemRow({
  spec,
  checked,
  onToggle,
  moveControls,
}: {
  spec: HeaderRightItemSpec;
  checked: boolean;
  onToggle: () => void;
  moveControls?: React.ReactNode;
}) {
  const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
  const isAiChat = spec.name === "ai-chat";
  return (
    <li
      className={`flex items-center gap-x-hsp-xs text-small ${checked ? "text-fg" : "text-muted"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include ${label}`}
        className="accent-accent"
      />
      <span className="flex-1">
        {label}
        {isAiChat && (
          <span className="ml-hsp-xs text-caption text-muted">
            (requires aiAssistant — disabled in scaffold)
          </span>
        )}
      </span>
      {moveControls}
    </li>
  );
}

const inputClass =
  "w-full border border-muted bg-bg text-fg px-hsp-sm py-vsp-2xs text-small focus:border-accent focus:outline-none";

function PresetModal({
  state,
  onClose,
}: {
  state: FormState;
  onClose: () => void;
}) {
  const [showCli, setShowCli] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const output = useMemo(
    () =>
      showCli
        ? buildCliCommand(state)
        : JSON.stringify(buildJson(state), null, 2),
    [showCli, state],
  );

  // PresetModal opens immediately on mount and stays open until the parent
  // unmounts it (modalState === null). isOpen is always true here — the
  // parent mounts/unmounts to control visibility. useModalDialog handles
  // the native showModal() call, the close-event callback, and backdrop click.
  const { dialogRef, handleBackdropClick } = useModalDialog({
    isOpen: true,
    onClose,
    backdropClickClose: true,
  });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function handleCopy() {
    let ok = false;
    // Prefer the modern async Clipboard API when available; fall back to the
    // legacy execCommand path for environments that lack it (#2136 L4).
    try {
      await navigator.clipboard.writeText(output);
      ok = true;
    } catch {
      /* ignore — fall through to execCommand */
    }
    if (!ok) {
      const dialog = dialogRef.current;
      if (dialog) {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = output;
          textarea.style.cssText = "position:fixed;opacity:0;left:-9999px";
          dialog.appendChild(textarea);
          textarea.focus();
          textarea.select();
          ok = document.execCommand("copy");
          dialog.removeChild(textarea);
        } catch {
          /* ignore */
        }
      }
    }
    setCopyLabel(ok ? "Copied!" : "Failed");
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mx-auto max-h-[80vh] w-full max-w-[40rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{
        color: "var(--color-fg)",
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        userSelect: "text",
      }}
    >
      <div className="mb-vsp-sm text-title font-bold text-fg">
        Generated Preset
      </div>

      <label className="mb-vsp-sm flex items-center gap-x-hsp-sm text-small text-fg">
        <input
          type="checkbox"
          checked={showCli}
          onChange={(e) => setShowCli((e.target as HTMLInputElement).checked)}
          className="accent-accent"
        />
        as CLI command
      </label>

      <pre className="overflow-x-auto border border-muted bg-code-bg p-hsp-lg text-small text-code-fg whitespace-pre-wrap break-all">
        <code>{output}</code>
      </pre>

      <div className="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          onClick={handleCopy}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {copyLabel}
        </button>
        <button
          onClick={() => dialogRef.current?.close()}
          className="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

// ── Main Component ──

export default function PresetGenerator() {
  const [state, setState] = useState<FormState>({
    projectName: "my-docs",
    defaultLang: "en",
    colorSchemeMode: "light-dark",
    singleScheme: "Default Dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    defaultMode: "dark",
    respectPrefersColorScheme: true,
    features: FEATURES.filter((f) => f.default).map((f) => f.value),
    cjkFriendly: true,
    packageManager: "pnpm",
    headerRightItems: [...INITIAL_HEADER_RIGHT_ITEMS],
    metaTags: { ...DEFAULT_META_TAGS },
  });

  const [modalState, setModalState] = useState<FormState | null>(null);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleFeature = useCallback((value: string) => {
    setState((prev) => {
      const features = prev.features.includes(value)
        ? prev.features.filter((f) => f !== value)
        : [...prev.features, value];
      return { ...prev, features };
    });
  }, []);

  // Header-right items: present rows in user-chosen order, support per-row
  // checkbox (off removes the item entirely from state), arrow buttons to
  // reorder, and a Reset-to-default button. The presence/absence of an item is
  // the single source of truth — there is no "shadow off-list" to merge back.
  const toggleHeaderRightItem = useCallback((spec: HeaderRightItemSpec) => {
    setState((prev) => {
      const key = headerRightItemKey(spec);
      const existsAt = prev.headerRightItems.findIndex(
        (item) => headerRightItemKey(item) === key,
      );
      if (existsAt >= 0) {
        return {
          ...prev,
          headerRightItems: prev.headerRightItems.filter((_, i) => i !== existsAt),
        };
      }
      // Re-adding: append at the end. Users can reorder afterwards.
      return {
        ...prev,
        headerRightItems: [...prev.headerRightItems, spec],
      };
    });
  }, []);

  const moveHeaderRightItem = useCallback(
    (index: number, direction: -1 | 1) => {
      setState((prev) => {
        const target = index + direction;
        if (target < 0 || target >= prev.headerRightItems.length) return prev;
        const next = [...prev.headerRightItems];
        const tmp = next[index]!;
        next[index] = next[target]!;
        next[target] = tmp;
        return { ...prev, headerRightItems: next };
      });
    },
    [],
  );

  const resetHeaderRightItems = useCallback(() => {
    setState((prev) => ({
      ...prev,
      headerRightItems: [...INITIAL_HEADER_RIGHT_ITEMS],
    }));
  }, []);

  const { orderedItems, missingItems } = useMemo(() => {
    const allSpecs: HeaderRightItemSpec[] = [...DEFAULT_HEADER_RIGHT_ITEMS];
    const presentKeys = new Set(
      state.headerRightItems.map(headerRightItemKey),
    );
    const missingItems = allSpecs.filter(
      (spec) => !presentKeys.has(headerRightItemKey(spec)),
    );
    const orderedItems: Array<{ spec: HeaderRightItemSpec; index: number }> =
      state.headerRightItems.map((spec, index) => ({ spec, index }));
    return { orderedItems, missingItems };
  }, [state.headerRightItems]);

  return (
    <div className="zd-preset-gen flex flex-col gap-y-vsp-xl">
      {/* Project Name */}
      <section>
        <SectionHeading>Project Name</SectionHeading>
        <input
          type="text"
          value={state.projectName}
          placeholder="my-docs"
          aria-label="Project name"
          onChange={(e) =>
            update("projectName", (e.target as HTMLInputElement).value)
          }
          className={inputClass}
        />
      </section>

      {/* Default Language */}
      <section>
        <SectionHeading>Default Language</SectionHeading>
        <select
          value={state.defaultLang}
          aria-label="Default language"
          onChange={(e) =>
            update("defaultLang", (e.target as HTMLSelectElement).value)
          }
          className={inputClass}
        >
          {SUPPORTED_LANGS.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </section>

      {/* Color Scheme Mode */}
      <section>
        <SectionHeading>Color Scheme Mode</SectionHeading>
        <div className="flex gap-x-hsp-lg">
          <label className="flex items-center gap-x-hsp-xs text-small text-fg">
            <input
              type="radio"
              name="colorSchemeMode"
              value="single"
              checked={state.colorSchemeMode === "single"}
              onChange={() => update("colorSchemeMode", "single")}
              className="accent-accent"
            />
            Single scheme
          </label>
          <label className="flex items-center gap-x-hsp-xs text-small text-fg">
            <input
              type="radio"
              name="colorSchemeMode"
              value="light-dark"
              checked={state.colorSchemeMode === "light-dark"}
              onChange={() => update("colorSchemeMode", "light-dark")}
              className="accent-accent"
            />
            Light &amp; Dark (toggle)
          </label>
        </div>
      </section>

      {/* Color Scheme Selection */}
      <section>
        <SectionHeading>Color Scheme</SectionHeading>
        {state.colorSchemeMode === "single" ? (
          <select
            value={state.singleScheme}
            aria-label="Color scheme"
            onChange={(e) =>
              update("singleScheme", (e.target as HTMLSelectElement).value)
            }
            className={inputClass}
          >
            {SINGLE_SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-col gap-y-vsp-xs">
            <div>
              <label className="mb-vsp-2xs block text-caption text-muted">
                Light scheme
              </label>
              <select
                value={state.lightScheme}
                aria-label="Light scheme"
                onChange={(e) =>
                  update(
                    "lightScheme",
                    (e.target as HTMLSelectElement).value,
                  )
                }
                className={inputClass}
              >
                {LIGHT_SCHEMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-vsp-2xs block text-caption text-muted">
                Dark scheme
              </label>
              <select
                value={state.darkScheme}
                aria-label="Dark scheme"
                onChange={(e) =>
                  update("darkScheme", (e.target as HTMLSelectElement).value)
                }
                className={inputClass}
              >
                {DARK_SCHEMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-x-hsp-lg gap-y-vsp-2xs">
              <div>
                <label className="mb-vsp-2xs block text-caption text-muted">
                  Default mode
                </label>
                <div className="flex gap-x-hsp-md">
                  <label className="flex items-center gap-x-hsp-xs text-small text-fg">
                    <input
                      type="radio"
                      name="defaultMode"
                      value="light"
                      checked={state.defaultMode === "light"}
                      onChange={() => update("defaultMode", "light")}
                      className="accent-accent"
                    />
                    Light
                  </label>
                  <label className="flex items-center gap-x-hsp-xs text-small text-fg">
                    <input
                      type="radio"
                      name="defaultMode"
                      value="dark"
                      checked={state.defaultMode === "dark"}
                      onChange={() => update("defaultMode", "dark")}
                      className="accent-accent"
                    />
                    Dark
                  </label>
                </div>
              </div>
              <label className="flex items-center gap-x-hsp-xs text-small text-fg self-end">
                <input
                  type="checkbox"
                  checked={state.respectPrefersColorScheme}
                  onChange={(e) =>
                    update(
                      "respectPrefersColorScheme",
                      (e.target as HTMLInputElement).checked,
                    )
                  }
                  className="accent-accent"
                />
                Respect system preference
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Features */}
      <section>
        <SectionHeading>Features</SectionHeading>
        <div className="flex flex-col gap-y-vsp-xs">
          {FEATURES.map((feat) => (
            <label
              key={feat.value}
              className="flex items-center gap-x-hsp-xs text-small text-fg"
            >
              <input
                type="checkbox"
                checked={state.features.includes(feat.value)}
                onChange={() => toggleFeature(feat.value)}
                className="accent-accent"
              />
              {feat.label}
            </label>
          ))}
          <label className="flex items-center gap-x-hsp-xs text-small text-muted cursor-not-allowed opacity-50">
            <input
              type="checkbox"
              disabled
              className="accent-accent"
            />
            AI Assistant (under development)
          </label>
        </div>
      </section>

      {/* Header right items */}
      <section>
        <SectionHeading>Header right items</SectionHeading>
        <p className="mb-vsp-xs text-caption text-muted">
          Choose which items appear in the header right cluster and in what
          order. Disabled items are dropped from the preset entirely. The
          ai-chat trigger is shown for forward-compatibility but the scaffold
          hardcodes <code>aiAssistant: false</code> so it never renders.
        </p>
        {/* Show items in current state order first, then any default items
            that the user has removed (so they can be re-enabled). */}
        <ul className="flex flex-col gap-y-vsp-2xs">
          {orderedItems.map(({ spec, index }) => {
            const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
            return (
              <HeaderRightItemRow
                key={headerRightItemKey(spec)}
                spec={spec}
                checked={true}
                onToggle={() => toggleHeaderRightItem(spec)}
                moveControls={
                  <>
                    <button
                      type="button"
                      onClick={() => moveHeaderRightItem(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${label} up`}
                      className="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHeaderRightItem(index, 1)}
                      disabled={index === orderedItems.length - 1}
                      aria-label={`Move ${label} down`}
                      className="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ↓
                    </button>
                  </>
                }
              />
            );
          })}
          {missingItems.map((spec) => (
            <HeaderRightItemRow
              key={headerRightItemKey(spec)}
              spec={spec}
              checked={false}
              onToggle={() => toggleHeaderRightItem(spec)}
            />
          ))}
        </ul>
        <div className="mt-vsp-xs">
          <button
            type="button"
            onClick={resetHeaderRightItems}
            className="border border-muted bg-surface px-hsp-md py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
          >
            Reset to default
          </button>
        </div>
      </section>

      {/* Meta tags */}
      <section>
        <SectionHeading>Meta tags</SectionHeading>
        <p className="mb-vsp-xs text-caption text-muted">
          Configure which meta tags are emitted in the document head.
          og:title is always emitted (DocHead contract) and is not listed here.
        </p>
        <ul className="flex flex-col gap-y-vsp-xs">
          {/* description */}
          <li className={`text-small ${state.metaTags.description ? "text-fg" : "text-muted"}`}>
            <label className="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.description}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, description: (e.target as HTMLInputElement).checked },
                  }))
                }
                className="accent-accent"
              />
              SEO description meta
            </label>
          </li>
          {/* keywords */}
          <li className={`text-small ${state.metaTags.keywordsEnabled ? "text-fg" : "text-muted"}`}>
            <label className="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.keywordsEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, keywordsEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                className="accent-accent"
              />
              Keywords (comma-separated)
            </label>
            {state.metaTags.keywordsEnabled && (
              <input
                type="text"
                value={state.metaTags.keywords}
                placeholder="docs, guide, reference"
                aria-label="Keywords (comma-separated)"
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, keywords: (e.target as HTMLInputElement).value },
                  }))
                }
                className={`mt-vsp-2xs ${inputClass}`}
              />
            )}
          </li>
          {/* og:image */}
          <li className={`text-small ${state.metaTags.ogImageEnabled ? "text-fg" : "text-muted"}`}>
            <label className="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.ogImageEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, ogImageEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                className="accent-accent"
              />
              OGP image (og:image)
            </label>
            {state.metaTags.ogImageEnabled && (
              <input
                type="text"
                value={state.metaTags.ogImage}
                placeholder="/img/ogp.png"
                aria-label="OGP image path"
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, ogImage: (e.target as HTMLInputElement).value },
                  }))
                }
                className={`mt-vsp-2xs ${inputClass}`}
              />
            )}
          </li>
          {/* og:site_name */}
          <li className={`text-small ${state.metaTags.ogSiteName ? "text-fg" : "text-muted"}`}>
            <label className="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.ogSiteName}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, ogSiteName: (e.target as HTMLInputElement).checked },
                  }))
                }
                className="accent-accent"
              />
              og:site_name
            </label>
          </li>
          {/* Twitter card */}
          <li className={`text-small ${state.metaTags.twitterCardEnabled ? "text-fg" : "text-muted"}`}>
            <label className="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.twitterCardEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, twitterCardEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                className="accent-accent"
              />
              Twitter card
            </label>
            {state.metaTags.twitterCardEnabled && (
              <div className="mt-vsp-2xs flex flex-col gap-y-vsp-2xs">
                <select
                  value={state.metaTags.twitterCard}
                  aria-label="Twitter card type"
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      metaTags: {
                        ...prev.metaTags,
                        twitterCard: (e.target as HTMLSelectElement).value as "summary" | "summary_large_image",
                      },
                    }))
                  }
                  className={inputClass}
                >
                  <option value="summary">summary</option>
                  <option value="summary_large_image">summary_large_image</option>
                </select>
                <input
                  type="text"
                  value={state.metaTags.twitterSite}
                  placeholder="@yourbrand (optional)"
                  aria-label="twitter:site handle"
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      metaTags: { ...prev.metaTags, twitterSite: (e.target as HTMLInputElement).value },
                    }))
                  }
                  className={inputClass}
                />
                <input
                  type="text"
                  value={state.metaTags.twitterCreator}
                  placeholder="@author (optional)"
                  aria-label="twitter:creator handle"
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      metaTags: { ...prev.metaTags, twitterCreator: (e.target as HTMLInputElement).value },
                    }))
                  }
                  className={inputClass}
                />
              </div>
            )}
          </li>
        </ul>
      </section>

      {/* CJK Friendly */}
      <section>
        <SectionHeading>Markdown Options</SectionHeading>
        <label className="flex items-center gap-x-hsp-xs text-small text-fg">
          <input
            type="checkbox"
            checked={state.cjkFriendly}
            onChange={(e) =>
              update("cjkFriendly", (e.target as HTMLInputElement).checked)
            }
            className="accent-accent"
          />
          CJK-friendly bold/italic (for Japanese, Chinese, Korean content)
        </label>
      </section>

      {/* Package Manager */}
      <section>
        <SectionHeading>Package Manager</SectionHeading>
        <select
          value={state.packageManager}
          aria-label="Package manager"
          onChange={(e) =>
            update("packageManager", (e.target as HTMLSelectElement).value)
          }
          className={inputClass}
        >
          {PACKAGE_MANAGERS.map((pm) => (
            <option key={pm} value={pm}>
              {pm}
            </option>
          ))}
        </select>
      </section>

      {/* Generate Button */}
      <div className="mt-vsp-xs">
        <button
          onClick={() => setModalState({ ...state })}
          className="border border-accent bg-surface px-hsp-xl py-vsp-2xs text-small font-semibold text-accent transition-colors hover:bg-bg hover:text-accent-hover"
        >
          Generate Preset
        </button>
      </div>

      {/* Modal */}
      {modalState && (
        <PresetModal state={modalState} onClose={() => setModalState(null)} />
      )}
    </div>
  );
}
