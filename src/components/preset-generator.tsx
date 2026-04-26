import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  FEATURES,
  buildJson,
  buildCliCommand,
  DEFAULT_HEADER_RIGHT_ITEMS,
  type FormState,
  type HeaderRightItemSpec,
} from "../lib/preset-generator-logic";
import { HeadingH3 } from "./content/heading-h3";

// ── Data ──

const SINGLE_SCHEMES = [
  "Default Dark",
  "Dracula",
  "Catppuccin Mocha",
  "GitHub Dark",
  "Nord",
  "TokyoNight",
  "Gruvbox Dark",
  "Atom One Dark",
  "Rose Pine",
  "Solarized Dark",
  "Material Ocean",
  "Monokai Pro",
  "Everforest Dark",
  "Kanagawa Wave",
  "Night Owl",
  "Ayu Dark",
  "VS Code Dark+",
  "Doom One",
  "Challenger Deep",
  "Catppuccin Frappe",
  "Catppuccin Macchiato",
  "Gruvbox Dark Hard",
  "Rose Pine Moon",
  "GitHub Dark Dimmed",
  "Ayu Mirage",
  "Material Darker",
  "Material Dark",
  "Monokai Remastered",
  "Monokai Vivid",
  "Monokai Soda",
  "Solarized Dark Higher Contrast",
  "Gruvbox Material Dark",
  "Kanagawa Dragon",
  "Default Light",
  "GitHub Light",
  "Catppuccin Latte",
  "Solarized Light",
  "Rose Pine Dawn",
  "Atom One Light",
  "Everforest Light",
  "Gruvbox Light",
  "Ayu Light",
] as const;

const LIGHT_SCHEMES = [
  "Default Light",
  "GitHub Light",
  "Catppuccin Latte",
  "Solarized Light",
  "Rose Pine Dawn",
  "Atom One Light",
  "Everforest Light",
  "Gruvbox Light",
  "Ayu Light",
] as const;

const DARK_SCHEMES = SINGLE_SCHEMES.filter(
  (s) => !(LIGHT_SCHEMES as readonly string[]).includes(s),
);

const SUPPORTED_LANGS = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh-cn", label: "Chinese (Simplified)" },
  { value: "zh-tw", label: "Chinese (Traditional)" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
] as const;

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

// Display labels for header-right items. Keep in sync with the canonical names
// defined in src/config/settings-types.ts (HeaderRightComponentName /
// HeaderRightTriggerName). Order does not matter here — the user reorders
// state.headerRightItems directly.
const HEADER_RIGHT_LABELS: Record<string, string> = {
  "version-switcher": "Version switcher",
  "design-token-panel": "Design token panel (trigger)",
  "ai-chat": "AI chat (trigger)",
  "github-link": "GitHub link",
  "theme-toggle": "Theme toggle",
  search: "Search",
  "language-switcher": "Language switcher",
};

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const output = useMemo(
    () =>
      showCli
        ? buildCliCommand(state)
        : JSON.stringify(buildJson(state), null, 2),
    [showCli, state],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleBackdropClick(e: React.MouseEvent) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
    }
  }

  async function handleCopy() {
    let ok = false;
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
    if (!ok) {
      try {
        await navigator.clipboard.writeText(output);
        ok = true;
      } catch {
        /* ignore */
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
      <div className="mb-vsp-sm text-subheading font-bold text-fg">
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
    headerRightItems: [...DEFAULT_HEADER_RIGHT_ITEMS],
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
      headerRightItems: [...DEFAULT_HEADER_RIGHT_ITEMS],
    }));
  }, []);

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
        <ul className="flex flex-col gap-y-vsp-2xs">
          {(() => {
            const allSpecs: HeaderRightItemSpec[] = [
              ...DEFAULT_HEADER_RIGHT_ITEMS,
            ];
            // Show items in current state order first, then any default items
            // that the user has removed (so they can be re-enabled).
            const presentKeys = new Set(
              state.headerRightItems.map(headerRightItemKey),
            );
            const missing = allSpecs.filter(
              (spec) => !presentKeys.has(headerRightItemKey(spec)),
            );
            const ordered: Array<{ spec: HeaderRightItemSpec; index: number }> =
              state.headerRightItems.map((spec, index) => ({ spec, index }));

            return (
              <>
                {ordered.map(({ spec, index }) => {
                  const key = headerRightItemKey(spec);
                  const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
                  const isAiChat = spec.name === "ai-chat";
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-x-hsp-xs text-small text-fg"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleHeaderRightItem(spec)}
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
                        disabled={index === ordered.length - 1}
                        aria-label={`Move ${label} down`}
                        className="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ↓
                      </button>
                    </li>
                  );
                })}
                {missing.map((spec) => {
                  const key = headerRightItemKey(spec);
                  const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
                  const isAiChat = spec.name === "ai-chat";
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-x-hsp-xs text-small text-muted"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleHeaderRightItem(spec)}
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
                    </li>
                  );
                })}
              </>
            );
          })()}
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
