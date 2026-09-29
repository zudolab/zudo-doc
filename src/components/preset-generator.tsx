"use client";

import type { ComponentChildren, JSX } from "preact";
import { useState, useCallback, useMemo, useRef, useEffect } from "preact/hooks";
import { useModalDialog } from "@takazudo/zudo-doc/use-modal-dialog";
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
  THEME_PACKS,
  validateAdditionalLangs,
  type FormState,
  type HeaderRightItemSpec,
  type FeatureEntry,
} from "../lib/preset-generator-logic";
import { HeadingH3 } from "@takazudo/zudo-doc/content";

// ── Data ──

const DARK_SCHEMES = SINGLE_SCHEMES.filter(
  (s) => !(LIGHT_SCHEMES as readonly string[]).includes(s),
);

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

const VISIBLE_FEATURES = FEATURES.filter((feature) => feature.value !== "i18n");

function headerRightItemKey(item: HeaderRightItemSpec): string {
  return `${item.kind}:${item.name}`;
}

// ── Sub-components ──

function SectionHeading({ children }: { children: ComponentChildren }) {
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
  moveControls?: ComponentChildren;
}) {
  const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
  const isAiChat = spec.name === "ai-chat";
  return (
    <li
      class={`flex items-center gap-x-hsp-xs text-small ${checked ? "text-fg" : "text-muted"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include ${label}`}
        class="accent-accent"
      />
      <span class="flex-1">
        {label}
        {isAiChat && (
          <span class="ml-hsp-xs text-caption text-muted">
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
  // The package hook's handler is typed via preact/compat (React-flavored
  // MouseEvent); this file compiles preact-native under tsconfig.pages.json.
  // Same runtime event either way — bridge the two typing flavors here.
  const onDialogClick = handleBackdropClick as unknown as JSX.MouseEventHandler<HTMLDialogElement>;

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
      onClick={onDialogClick}
      class="mx-auto max-h-[80vh] w-full max-w-[40rem] overflow-y-auto border border-muted bg-surface p-hsp-xl backdrop:bg-bg/80"
      style={{
        color: "var(--color-fg)",
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        "user-select": "text",
      }}
    >
      <div class="mb-vsp-sm text-title font-bold text-fg">
        Generated Preset
      </div>

      <label class="mb-vsp-sm flex items-center gap-x-hsp-sm text-small text-fg">
        <input
          type="checkbox"
          checked={showCli}
          onChange={(e) => setShowCli((e.target as HTMLInputElement).checked)}
          class="accent-accent"
        />
        as CLI command
      </label>

      <pre class="overflow-x-auto border border-muted bg-code-bg p-hsp-lg text-small text-code-fg whitespace-pre-wrap break-all">
        <code>{output}</code>
      </pre>

      <div class="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          onClick={handleCopy}
          class="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {copyLabel}
        </button>
        <button
          onClick={() => dialogRef.current?.close()}
          class="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
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
    additionalLangs: "",
    colorSchemeMode: "light-dark",
    singleScheme: "Default Dark",
    lightScheme: "Default Light",
    darkScheme: "Default Dark",
    defaultMode: "dark",
    respectPrefersColorScheme: true,
    themePack: "default",
    features: FEATURES.filter((f) => f.default).map((f) => f.value),
    cjkFriendly: true,
    packageManager: "pnpm",
    headerRightItems: [...INITIAL_HEADER_RIGHT_ITEMS],
    metaTags: { ...DEFAULT_META_TAGS, ogImageEnabled: true },
  });

  const [modalState, setModalState] = useState<FormState | null>(null);

  const additionalLangsError = useMemo(
    () => validateAdditionalLangs(state.additionalLangs, state.defaultLang),
    [state.additionalLangs, state.defaultLang],
  );

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
    <div class="zd-preset-gen flex flex-col gap-y-vsp-xl">
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
          class={inputClass}
        />
      </section>

      {/* Languages */}
      <section>
        <SectionHeading>Languages</SectionHeading>
        <div class="flex flex-col gap-y-vsp-xs">
          <label
            for="preset-default-language"
            class="text-caption text-muted"
          >
            Default language
          </label>
          <select
            id="preset-default-language"
            value={state.defaultLang}
            aria-label="Default language"
            onChange={(e) =>
              update("defaultLang", (e.target as HTMLSelectElement).value)
            }
            class={inputClass}
          >
            {SUPPORTED_LANGS.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <label
            for="preset-additional-languages"
            class="text-caption text-muted"
          >
            Additional language codes
          </label>
          <input
            id="preset-additional-languages"
            type="text"
            value={state.additionalLangs}
            placeholder="ja, de"
            aria-label="Additional language codes"
            aria-invalid={additionalLangsError !== null}
            aria-describedby={
              additionalLangsError ? "additional-langs-error" : undefined
            }
            onChange={(e) =>
              update(
                "additionalLangs",
                (e.target as HTMLInputElement).value,
              )
            }
            class={inputClass}
          />
          <p class="text-caption text-muted">
            Comma-separated additional locale codes (for example, ja, de).
          </p>
          {additionalLangsError && (
            <p
              id="additional-langs-error"
              role="alert"
              class="text-caption text-danger"
            >
              {additionalLangsError}
            </p>
          )}
        </div>
      </section>

      {/* Color Scheme Mode */}
      <section>
        <SectionHeading>Color Scheme Mode</SectionHeading>
        <div class="flex gap-x-hsp-lg">
          <label class="flex items-center gap-x-hsp-xs text-small text-fg">
            <input
              type="radio"
              name="colorSchemeMode"
              value="single"
              checked={state.colorSchemeMode === "single"}
              onChange={() => update("colorSchemeMode", "single")}
              class="accent-accent"
            />
            Single scheme
          </label>
          <label class="flex items-center gap-x-hsp-xs text-small text-fg">
            <input
              type="radio"
              name="colorSchemeMode"
              value="light-dark"
              checked={state.colorSchemeMode === "light-dark"}
              onChange={() => update("colorSchemeMode", "light-dark")}
              class="accent-accent"
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
            class={inputClass}
          >
            {SINGLE_SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <div class="flex flex-col gap-y-vsp-xs">
            <div class="flex flex-wrap gap-x-hsp-lg gap-y-vsp-2xs">
              <div>
                <label class="mb-vsp-2xs block text-caption text-muted">
                  Default mode
                </label>
                <div class="flex gap-x-hsp-md">
                  <label class="flex items-center gap-x-hsp-xs text-small text-fg">
                    <input
                      type="radio"
                      name="defaultMode"
                      value="light"
                      checked={state.defaultMode === "light"}
                      onChange={() => update("defaultMode", "light")}
                      class="accent-accent"
                    />
                    Light
                  </label>
                  <label class="flex items-center gap-x-hsp-xs text-small text-fg">
                    <input
                      type="radio"
                      name="defaultMode"
                      value="dark"
                      checked={state.defaultMode === "dark"}
                      onChange={() => update("defaultMode", "dark")}
                      class="accent-accent"
                    />
                    Dark
                  </label>
                </div>
              </div>
              <label class="flex items-center gap-x-hsp-xs text-small text-fg self-end">
                <input
                  type="checkbox"
                  checked={state.respectPrefersColorScheme}
                  onChange={(e) =>
                    update(
                      "respectPrefersColorScheme",
                      (e.target as HTMLInputElement).checked,
                    )
                  }
                  class="accent-accent"
                />
                Respect system preference
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Theme Pack (ADR #2818 Decision 7) */}
      <section>
        <SectionHeading>Theme Pack</SectionHeading>
        <select
          value={state.themePack}
          aria-label="Theme pack"
          onChange={(e) =>
            update("themePack", (e.target as HTMLSelectElement).value)
          }
          class={inputClass}
        >
          {THEME_PACKS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
        <p class="mt-vsp-2xs text-caption text-muted">
          {THEME_PACKS.find((t) => t.slug === state.themePack)?.hint}
        </p>
      </section>

      {/* Features */}
      <section>
        <SectionHeading>Features</SectionHeading>
        <div class="flex flex-col gap-y-vsp-xs">
          {(VISIBLE_FEATURES as readonly FeatureEntry[]).map((feat) => (
            <label
              key={feat.value}
              class="flex items-center gap-x-hsp-xs text-small text-fg"
            >
              <input
                type="checkbox"
                checked={state.features.includes(feat.value)}
                onChange={() => toggleFeature(feat.value)}
                class="accent-accent"
              />
              <span class="flex items-center gap-x-hsp-xs">
                {feat.label}
                {feat.docPath && (
                  <a
                    href={feat.docPath}
                    target="_blank"
                    rel="noopener"
                    aria-label={`${feat.label} documentation`}
                    onClick={(e) => e.stopPropagation()}
                    class="text-caption text-muted hover:text-accent"
                  >
                    docs ↗
                  </a>
                )}
              </span>
            </label>
          ))}
          <label class="flex items-center gap-x-hsp-xs text-small text-muted cursor-not-allowed opacity-50">
            <input
              type="checkbox"
              disabled
              class="accent-accent"
            />
            AI Assistant (under development)
          </label>
        </div>
      </section>

      {/* Header right items */}
      <section>
        <SectionHeading>Header right items</SectionHeading>
        <p class="mb-vsp-xs text-caption text-muted">
          Choose which items appear in the header right cluster and in what
          order. Disabled items are dropped from the preset entirely. The
          ai-chat trigger is shown for forward-compatibility but the scaffold
          hardcodes <code>aiAssistant: false</code> so it never renders.
        </p>
        {/* Show items in current state order first, then any default items
            that the user has removed (so they can be re-enabled). */}
        <ul class="flex flex-col gap-y-vsp-2xs">
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
                      class="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHeaderRightItem(index, 1)}
                      disabled={index === orderedItems.length - 1}
                      aria-label={`Move ${label} down`}
                      class="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
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
        <div class="mt-vsp-xs">
          <button
            type="button"
            onClick={resetHeaderRightItems}
            class="border border-muted bg-surface px-hsp-md py-vsp-2xs text-small text-muted transition-colors hover:border-fg hover:text-fg"
          >
            Reset to default
          </button>
        </div>
      </section>

      {/* Meta tags */}
      <section>
        <SectionHeading>Meta tags</SectionHeading>
        <p class="mb-vsp-xs text-caption text-muted">
          Configure which meta tags are emitted in the document head.
          og:title is always emitted (DocHead contract) and is not listed here.
        </p>
        <ul class="flex flex-col gap-y-vsp-xs">
          {/* description */}
          <li class={`text-small ${state.metaTags.description ? "text-fg" : "text-muted"}`}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.description}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, description: (e.target as HTMLInputElement).checked },
                  }))
                }
                class="accent-accent"
              />
              SEO description meta
            </label>
          </li>
          {/* keywords */}
          <li class={`text-small ${state.metaTags.keywordsEnabled ? "text-fg" : "text-muted"}`}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.keywordsEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, keywordsEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                class="accent-accent"
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
                class={`mt-vsp-2xs ${inputClass}`}
              />
            )}
          </li>
          {/* og:image */}
          <li class={`text-small ${state.metaTags.ogImageEnabled ? "text-fg" : "text-muted"}`}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.ogImageEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, ogImageEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                class="accent-accent"
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
                class={`mt-vsp-2xs ${inputClass}`}
              />
            )}
          </li>
          {/* og:site_name */}
          <li class={`text-small ${state.metaTags.ogSiteName ? "text-fg" : "text-muted"}`}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.ogSiteName}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, ogSiteName: (e.target as HTMLInputElement).checked },
                  }))
                }
                class="accent-accent"
              />
              og:site_name
            </label>
          </li>
          {/* Twitter card */}
          <li class={`text-small ${state.metaTags.twitterCardEnabled ? "text-fg" : "text-muted"}`}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                checked={state.metaTags.twitterCardEnabled}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    metaTags: { ...prev.metaTags, twitterCardEnabled: (e.target as HTMLInputElement).checked },
                  }))
                }
                class="accent-accent"
              />
              Twitter card
            </label>
            {state.metaTags.twitterCardEnabled && (
              <div class="mt-vsp-2xs flex flex-col gap-y-vsp-2xs">
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
                  class={inputClass}
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
                  class={inputClass}
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
                  class={inputClass}
                />
              </div>
            )}
          </li>
        </ul>
      </section>

      {/* CJK Friendly */}
      <section>
        <SectionHeading>Markdown Options</SectionHeading>
        <label class="flex items-center gap-x-hsp-xs text-small text-fg">
          <input
            type="checkbox"
            checked={state.cjkFriendly}
            onChange={(e) =>
              update("cjkFriendly", (e.target as HTMLInputElement).checked)
            }
            class="accent-accent"
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
          class={inputClass}
        >
          {PACKAGE_MANAGERS.map((pm) => (
            <option key={pm} value={pm}>
              {pm}
            </option>
          ))}
        </select>
      </section>

      {/* Generate Button */}
      <div class="mt-vsp-xs">
        <button
          disabled={additionalLangsError !== null}
          onClick={() => {
            if (additionalLangsError !== null) return;
            setModalState({ ...state });
          }}
          class="border border-accent bg-surface px-hsp-xl py-vsp-2xs text-small font-semibold text-accent transition-colors hover:bg-bg hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
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
