import { useState, useCallback, useMemo, useRef, useEffect } from "react";

// ── Data ──
// Keep in sync with packages/create-zudo-doc/src/constants.ts

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

const FEATURES = [
  { value: "i18n", label: "i18n (multi-language)", cliFlag: "i18n", default: false },
  { value: "search", label: "Pagefind search", cliFlag: "search", default: true },
  { value: "sidebarFilter", label: "Sidebar filter", cliFlag: "sidebar-filter", default: true },
  { value: "claudeResources", label: "Claude Resources", cliFlag: "claude-resources", default: false },
  { value: "colorTweakPanel", label: "Color tweak panel", cliFlag: "color-tweak-panel", default: false },
  { value: "sidebarResizer", label: "Sidebar resizer", cliFlag: "sidebar-resizer", default: false },
  { value: "versioning", label: "Versioning", cliFlag: "versioning", default: false },
] as const;

const PACKAGE_MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;

// ── Types ──

type ColorSchemeMode = "single" | "light-dark";

interface FormState {
  projectName: string;
  defaultLang: string;
  colorSchemeMode: ColorSchemeMode;
  singleScheme: string;
  lightScheme: string;
  darkScheme: string;
  defaultMode: "light" | "dark";
  respectPrefersColorScheme: boolean;
  features: string[];
  packageManager: string;
}

// ── Helpers ──

function buildJson(state: FormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    projectName: state.projectName || "my-docs",
    defaultLang: state.defaultLang,
    colorSchemeMode: state.colorSchemeMode,
  };

  if (state.colorSchemeMode === "single") {
    base.singleScheme = state.singleScheme;
  } else {
    base.lightScheme = state.lightScheme;
    base.darkScheme = state.darkScheme;
    base.defaultMode = state.defaultMode;
    base.respectPrefersColorScheme = state.respectPrefersColorScheme;
  }

  base.features = state.features;
  base.packageManager = state.packageManager;
  return base;
}

function buildCliCommand(state: FormState): string {
  const pm = state.packageManager;
  const name = state.projectName || "my-docs";
  const quotedName = /\s/.test(name) ? `"${name}"` : name;
  const parts = [`${pm} create zudo-doc ${quotedName}`];

  parts.push(`--lang ${state.defaultLang}`);
  parts.push(`--color-scheme-mode ${state.colorSchemeMode}`);

  if (state.colorSchemeMode === "single") {
    parts.push(`--scheme "${state.singleScheme}"`);
  } else {
    parts.push(`--light-scheme "${state.lightScheme}"`);
    parts.push(`--dark-scheme "${state.darkScheme}"`);
    parts.push(`--default-mode ${state.defaultMode}`);
    if (state.respectPrefersColorScheme) {
      parts.push("--respect-system-preference");
    } else {
      parts.push("--no-respect-system-preference");
    }
  }

  for (const feat of FEATURES) {
    const enabled = state.features.includes(feat.value);
    parts.push(enabled ? `--${feat.cliFlag}` : `--no-${feat.cliFlag}`);
  }

  parts.push(`--pm ${pm}`);
  parts.push("--yes");

  return parts.join(" ");
}

// ── Sub-components ──

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-vsp-2xs text-small font-semibold text-fg">
      {children}
    </h3>
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
    packageManager: "pnpm",
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

  return (
    <div className="flex flex-col gap-y-vsp-md">
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
        <div className="flex flex-col gap-y-vsp-2xs">
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
        </div>
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
