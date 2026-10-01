"use client";

import type { Child } from "@takazudo/zfb/zudo-react";
import { computed, For, getScope, Show, signal, type ReadonlySignal, type Signal } from "@takazudo/zfb/zudo-react";
import { modalDialog } from "@takazudo/zudo-doc/use-modal-dialog";
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

function SectionHeading({ children }: { children: Child }) {
  return (
    <HeadingH3 class="mb-vsp-xs">
      {children}
    </HeadingH3>
  );
}

function FeatureRow({ feature, features }: { feature: FeatureEntry; features: Signal<string[]> }) {
  const scope = getScope();
  const checked = signal(features.value.includes(feature.value));
  scope.onActivate(() => {
    // Model hydration may take the DOM value. Reconcile before the effect below.
    const next = checked.value;
    if (features.value.includes(feature.value) !== next) {
      features.value = next ? [...features.value, feature.value] : features.value.filter((value) => value !== feature.value);
    }
  });
  scope.effect(() => {
    const next = features.value.includes(feature.value);
    if (checked.value !== next) checked.value = next;
  });
  return <label class="flex items-center gap-x-hsp-xs text-small text-fg">
    <input type="checkbox" modelChecked={checked} on:change={(event) => {
      const next = (event.currentTarget as HTMLInputElement).checked;
      features.value = next ? [...new Set([...features.value, feature.value])] : features.value.filter((value) => value !== feature.value);
    }} class="accent-accent" />
    <span class="flex items-center gap-x-hsp-xs">{feature.label}
      {feature.docPath && <a href={feature.docPath} target="_blank" rel="noopener" aria-label={`${feature.label} documentation`} on:click={(event) => event.stopPropagation()} class="text-caption text-muted hover:text-accent">docs ↗</a>}
    </span>
  </label>;
}

function HeaderRightItemRow({ spec, items, index, move }: {
  spec: HeaderRightItemSpec;
  items: Signal<HeaderRightItemSpec[]>;
  index?: ReadonlySignal<number>;
  move: (spec: HeaderRightItemSpec, direction: -1 | 1) => void;
}) {
  const scope = getScope();
  const key = headerRightItemKey(spec);
  const label = HEADER_RIGHT_LABELS[spec.name] ?? spec.name;
  const checked = signal(items.value.some((item) => headerRightItemKey(item) === key));
  scope.onActivate(() => {
    const present = items.value.some((item) => headerRightItemKey(item) === key);
    if (present !== checked.value) items.value = checked.value ? [...items.value, spec] : items.value.filter((item) => headerRightItemKey(item) !== key);
  });
  scope.effect(() => {
    const next = items.value.some((item) => headerRightItemKey(item) === key);
    if (checked.value !== next) checked.value = next;
  });
  return <li class={computed(() => `flex items-center gap-x-hsp-xs text-small ${checked.value ? "text-fg" : "text-muted"}`)}>
    <input type="checkbox" modelChecked={checked} on:change={(event) => {
      const next = (event.currentTarget as HTMLInputElement).checked;
      items.value = next ? [...items.value.filter((item) => headerRightItemKey(item) !== key), spec] : items.value.filter((item) => headerRightItemKey(item) !== key);
    }} aria-label={`Include ${label}`} class="accent-accent" />
    <span class="flex-1">{label}{spec.name === "ai-chat" && <span class="ml-hsp-xs text-caption text-muted">(requires aiAssistant — disabled in scaffold)</span>}</span>
    {index && <>
      <button type="button" on:click={() => move(spec, -1)} disabled={computed(() => index.value === 0)} aria-label={`Move ${label} up`} class="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">↑</button>
      <button type="button" on:click={() => move(spec, 1)} disabled={computed(() => index.value === items.value.length - 1)} aria-label={`Move ${label} down`} class="border border-muted bg-surface px-hsp-xs py-vsp-2xs text-caption text-fg transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">↓</button>
    </>}
  </li>;
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
  const scope = getScope();
  const showCli = signal(false);
  const copyLabel = signal("Copy");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  scope.onCleanup(() => { if (copyTimer) clearTimeout(copyTimer); });

  const output = computed(() => showCli.value ? buildCliCommand(state) : JSON.stringify(buildJson(state), null, 2));

  const { dialogRef, handleBackdropClick } = modalDialog(scope, {
    isOpen: signal(true), onClose, backdropClickClose: true,
  });

  async function handleCopy() {
    let ok = false;
    // Prefer the modern async Clipboard API when available; fall back to the
    // legacy execCommand path for environments that lack it (#2136 L4).
    try {
      await navigator.clipboard.writeText(output.value);
      if (scope.abortSignal.aborted) return;
      ok = true;
    } catch {
      /* ignore — fall through to execCommand */
    }
    if (scope.abortSignal.aborted) return;
    if (!ok) {
      const dialog = dialogRef.current;
      if (dialog) {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = output.value;
          textarea.style.cssText = "position:fixed;opacity:0;left:-9999px";
          dialog.appendChild(textarea);
          textarea.focus();
          textarea.select();
          try { ok = document.execCommand("copy"); } finally { textarea.remove(); }
        } catch {
          /* ignore */
        }
      }
    }
    if (scope.abortSignal.aborted) return;
    copyLabel.value = ok ? "Copied!" : "Failed";
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { if (!scope.abortSignal.aborted) copyLabel.value = "Copy"; }, 2000);
  }

  return (
    <dialog
      ref={dialogRef}
      on:click={handleBackdropClick}
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
          modelChecked={showCli}
          class="accent-accent"
        />
        as CLI command
      </label>

      <pre class="overflow-x-auto border border-muted bg-code-bg p-hsp-lg text-small text-code-fg whitespace-pre-wrap break-all">
        <code>{output}</code>
      </pre>

      <div class="mt-vsp-sm flex items-center gap-x-hsp-md">
        <button
          on:click={handleCopy}
          class="border border-muted bg-surface px-hsp-lg py-vsp-2xs text-small text-fg transition-colors hover:border-accent hover:text-accent"
        >
          {copyLabel}
        </button>
        <button
          on:click={() => dialogRef.current?.close()}
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
  const projectName = signal("my-docs");
  const defaultLang = signal("en");
  const additionalLangs = signal("");
  const colorSchemeMode = signal<FormState["colorSchemeMode"]>("light-dark");
  const singleScheme = signal("Default Dark");
  const lightScheme = signal("Default Light");
  const darkScheme = signal("Default Dark");
  const defaultMode = signal<FormState["defaultMode"]>("dark");
  const respectPrefersColorScheme = signal(true);
  const themePack = signal("default");
  const features = signal(FEATURES.filter((feature) => feature.default).map((feature) => feature.value));
  const cjkFriendly = signal(true);
  const packageManager = signal("pnpm");
  const headerRightItems = signal<HeaderRightItemSpec[]>([...INITIAL_HEADER_RIGHT_ITEMS]);
  const description = signal(DEFAULT_META_TAGS.description);
  const keywordsEnabled = signal(DEFAULT_META_TAGS.keywordsEnabled);
  const keywords = signal(DEFAULT_META_TAGS.keywords);
  const ogImageEnabled = signal(true);
  const ogImage = signal(DEFAULT_META_TAGS.ogImage);
  const ogSiteName = signal(DEFAULT_META_TAGS.ogSiteName);
  const twitterCardEnabled = signal(DEFAULT_META_TAGS.twitterCardEnabled);
  const twitterCard = signal<FormState["metaTags"]["twitterCard"]>(DEFAULT_META_TAGS.twitterCard);
  const twitterSite = signal(DEFAULT_META_TAGS.twitterSite);
  const twitterCreator = signal(DEFAULT_META_TAGS.twitterCreator);
  const modalState = signal<FormState | null>(null);

  const additionalLangsError = computed(() => validateAdditionalLangs(additionalLangs.value, defaultLang.value));
  const currentState = computed<FormState>(() => ({
    projectName: projectName.value, defaultLang: defaultLang.value, additionalLangs: additionalLangs.value,
    colorSchemeMode: colorSchemeMode.value, singleScheme: singleScheme.value,
    lightScheme: lightScheme.value, darkScheme: darkScheme.value, defaultMode: defaultMode.value,
    respectPrefersColorScheme: respectPrefersColorScheme.value, themePack: themePack.value,
    features: features.value, cjkFriendly: cjkFriendly.value, packageManager: packageManager.value,
    headerRightItems: headerRightItems.value,
    metaTags: { description: description.value, keywordsEnabled: keywordsEnabled.value,
      keywords: keywords.value, ogImageEnabled: ogImageEnabled.value, ogImage: ogImage.value,
      ogSiteName: ogSiteName.value, twitterCardEnabled: twitterCardEnabled.value,
      twitterCard: twitterCard.value, twitterSite: twitterSite.value, twitterCreator: twitterCreator.value },
  }));
  const jsonOutput = computed(() => additionalLangsError.value === null ? buildJson(currentState.value) : null);
  const missingItems = computed(() => {
    const present = new Set(headerRightItems.value.map(headerRightItemKey));
    return DEFAULT_HEADER_RIGHT_ITEMS.filter((item) => !present.has(headerRightItemKey(item)));
  });
  function moveHeaderRightItem(spec: HeaderRightItemSpec, direction: -1 | 1) {
    const index = headerRightItems.value.findIndex((item) => headerRightItemKey(item) === headerRightItemKey(spec));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= headerRightItems.value.length) return;
    const next = [...headerRightItems.value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    headerRightItems.value = next;
  }

  return (
    <div class="zd-preset-gen flex flex-col gap-y-vsp-xl">
      {/* Project Name */}
      <section>
        <SectionHeading>Project Name</SectionHeading>
        <input
          type="text"
          modelValue={projectName}
          placeholder="my-docs"
          aria-label="Project name"
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
            modelValue={defaultLang}
            aria-label="Default language"
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
            modelValue={additionalLangs}
            placeholder="ja, de"
            aria-label="Additional language codes"
            aria-invalid={computed(() => additionalLangsError.value !== null)}
            aria-describedby={computed(() => additionalLangsError.value ? "additional-langs-error" : undefined)}
            class={inputClass}
          />
          <p class="text-caption text-muted">
            Comma-separated additional locale codes (for example, ja, de).
          </p>
          <Show when={computed(() => additionalLangsError.value !== null)}>{() => (
            <p
              id="additional-langs-error"
              role="alert"
              class="text-caption text-danger"
            >
              {additionalLangsError}
            </p>
          )}</Show>
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
              modelValue={colorSchemeMode}
              class="accent-accent"
            />
            Single scheme
          </label>
          <label class="flex items-center gap-x-hsp-xs text-small text-fg">
            <input
              type="radio"
              name="colorSchemeMode"
              value="light-dark"
              modelValue={colorSchemeMode}
              class="accent-accent"
            />
            Light &amp; Dark (toggle)
          </label>
        </div>
      </section>

      {/* Color Scheme Selection */}
      <section>
        <SectionHeading>Color Scheme</SectionHeading>
        <Show when={computed(() => colorSchemeMode.value === "single")}>{() => (
          <select modelValue={singleScheme} aria-label="Color scheme" class={inputClass}>
            {SINGLE_SCHEMES.map((scheme) => <option value={scheme}>{scheme}</option>)}
          </select>
        )}</Show>
        <Show when={computed(() => colorSchemeMode.value !== "single")}>{() => (
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
                      modelValue={defaultMode}
                              class="accent-accent"
                    />
                    Light
                  </label>
                  <label class="flex items-center gap-x-hsp-xs text-small text-fg">
                    <input
                      type="radio"
                      name="defaultMode"
                      value="dark"
                      modelValue={defaultMode}
                              class="accent-accent"
                    />
                    Dark
                  </label>
                </div>
              </div>
              <label class="flex items-center gap-x-hsp-xs text-small text-fg self-end">
                <input
                  type="checkbox"
                  modelChecked={respectPrefersColorScheme}
                  class="accent-accent"
                />
                Respect system preference
              </label>
            </div>
          </div>
        )}</Show>
      </section>

      {/* Theme Pack (ADR #2818 Decision 7) */}
      <section>
        <SectionHeading>Theme Pack</SectionHeading>
        <select
          modelValue={themePack}
          aria-label="Theme pack"
          class={inputClass}
        >
          {THEME_PACKS.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.label}
            </option>
          ))}
        </select>
        <p class="mt-vsp-2xs text-caption text-muted">
          {computed(() => THEME_PACKS.find((pack) => pack.slug === themePack.value)?.hint ?? "")}
        </p>
      </section>

      {/* Features */}
      <section>
        <SectionHeading>Features</SectionHeading>
        <div class="flex flex-col gap-y-vsp-xs">
          {VISIBLE_FEATURES.map((feature) => <FeatureRow feature={feature} features={features} />)}
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
          <For each={headerRightItems} by={headerRightItemKey}>{(item, index) => <HeaderRightItemRow spec={item.value} items={headerRightItems} index={index} move={moveHeaderRightItem} />}</For>
          <For each={missingItems} by={headerRightItemKey}>{(item) => <HeaderRightItemRow spec={item.value} items={headerRightItems} move={moveHeaderRightItem} />}</For>
        </ul>
        <div class="mt-vsp-xs">
          <button
            type="button"
            on:click={() => { headerRightItems.value = [...INITIAL_HEADER_RIGHT_ITEMS]; }}
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
          <li class={computed(() => `text-small ${description.value ? "text-fg" : "text-muted"}`)}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                modelChecked={description}
                  class="accent-accent"
              />
              SEO description meta
            </label>
          </li>
          {/* keywords */}
          <li class={computed(() => `text-small ${keywordsEnabled.value ? "text-fg" : "text-muted"}`)}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                modelChecked={keywordsEnabled}
                  class="accent-accent"
              />
              Keywords (comma-separated)
            </label>
            <Show when={keywordsEnabled}>{() => (
              <input
                type="text"
                modelValue={keywords}
                placeholder="docs, guide, reference"
                aria-label="Keywords (comma-separated)"
                  class={`mt-vsp-2xs ${inputClass}`}
              />
            )}</Show>
          </li>
          {/* og:image */}
          <li class={computed(() => `text-small ${ogImageEnabled.value ? "text-fg" : "text-muted"}`)}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                modelChecked={ogImageEnabled}
                  class="accent-accent"
              />
              OGP image (og:image)
            </label>
            <Show when={ogImageEnabled}>{() => (
              <input
                type="text"
                modelValue={ogImage}
                placeholder="/img/ogp.png"
                aria-label="OGP image path"
                  class={`mt-vsp-2xs ${inputClass}`}
              />
            )}</Show>
          </li>
          {/* og:site_name */}
          <li class={computed(() => `text-small ${ogSiteName.value ? "text-fg" : "text-muted"}`)}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                modelChecked={ogSiteName}
                  class="accent-accent"
              />
              og:site_name
            </label>
          </li>
          {/* Twitter card */}
          <li class={computed(() => `text-small ${twitterCardEnabled.value ? "text-fg" : "text-muted"}`)}>
            <label class="flex items-center gap-x-hsp-xs">
              <input
                type="checkbox"
                modelChecked={twitterCardEnabled}
                  class="accent-accent"
              />
              Twitter card
            </label>
            <Show when={twitterCardEnabled}>{() => (
              <div class="mt-vsp-2xs flex flex-col gap-y-vsp-2xs">
                <select
                  modelValue={twitterCard}
                  aria-label="Twitter card type"
                      class={inputClass}
                >
                  <option value="summary">summary</option>
                  <option value="summary_large_image">summary_large_image</option>
                </select>
                <input
                  type="text"
                  modelValue={twitterSite}
                  placeholder="@yourbrand (optional)"
                  aria-label="twitter:site handle"
                      class={inputClass}
                />
                <input
                  type="text"
                  modelValue={twitterCreator}
                  placeholder="@author (optional)"
                  aria-label="twitter:creator handle"
                      class={inputClass}
                />
              </div>
            )}</Show>
          </li>
        </ul>
      </section>

      {/* CJK Friendly */}
      <section>
        <SectionHeading>Markdown Options</SectionHeading>
        <label class="flex items-center gap-x-hsp-xs text-small text-fg">
          <input
            type="checkbox"
            modelChecked={cjkFriendly}
            class="accent-accent"
          />
          CJK-friendly bold/italic (for Japanese, Chinese, Korean content)
        </label>
      </section>

      {/* Package Manager */}
      <section>
        <SectionHeading>Package Manager</SectionHeading>
        <select
          modelValue={packageManager}
          aria-label="Package manager"
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
          disabled={computed(() => additionalLangsError.value !== null)}
          on:click={() => {
            if (additionalLangsError.value !== null || jsonOutput.value === null) return;
            modalState.value = currentState.value;
          }}
          class="border border-accent bg-surface px-hsp-xl py-vsp-2xs text-small font-semibold text-accent transition-colors hover:bg-bg hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Preset
        </button>
      </div>

      {/* Modal */}
      <Show when={computed(() => modalState.value !== null)}>{() => (
        <PresetModal state={modalState.value!} onClose={() => { modalState.value = null; }} />
      )}</Show>
    </div>
  );
}
