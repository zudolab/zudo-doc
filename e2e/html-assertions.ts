import { expect } from "@playwright/test";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canBeUnquoted(value: string): boolean {
  return !/[\s"'`=<>]/.test(value);
}

export function attrSource(name: string, value: string): string {
  const attrName = escapeRegExp(name);
  const attrValue = escapeRegExp(value);
  const quotedValue = `"${attrValue}"|'${attrValue}'`;
  const valueSource = canBeUnquoted(value)
    ? `${quotedValue}|${attrValue}`
    : quotedValue;
  return `\\b${attrName}\\s*=\\s*(?:${valueSource})(?=[\\s>/])`;
}

export function classAttrSource(className: string): string {
  const klass = escapeRegExp(className);
  return [
    "\\bclass\\s*=\\s*(?:",
    `"[^"]*\\b${klass}\\b[^"]*"`,
    `|'[^']*\\b${klass}\\b[^']*'`,
    `|[^\\s>]*\\b${klass}\\b[^\\s>]*`,
    ")(?=[\\s>/])",
  ].join("");
}

export function booleanAttrSource(name: string): string {
  const attrName = escapeRegExp(name);
  return `\\b${attrName}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s>/])`;
}

export function attrPattern(name: string, value: string): RegExp {
  return new RegExp(attrSource(name, value));
}

export function expectHtmlAttr(
  html: string,
  name: string,
  value: string,
): void {
  expect(html).toMatch(attrPattern(name, value));
}

export function tagWithAttrPattern(
  tagName: string,
  name: string,
  value: string,
): RegExp {
  return new RegExp(
    `<${escapeRegExp(tagName)}\\b(?=[^>]*${attrSource(name, value)})[^>]*>`,
  );
}

export function expectHtmlTagWithAttr(
  html: string,
  tagName: string,
  name: string,
  value: string,
): void {
  expect(html).toMatch(tagWithAttrPattern(tagName, name, value));
}

export function expectHtmlTagWithAttrs(
  html: string,
  tagName: string,
  attrs: Array<[name: string, value: string]>,
): void {
  const lookaheads = attrs
    .map(([name, value]) => `(?=[^>]*${attrSource(name, value)})`)
    .join("");
  expect(html).toMatch(
    new RegExp(`<${escapeRegExp(tagName)}\\b${lookaheads}[^>]*>`),
  );
}

export function expectHtmlClass(html: string, className: string): void {
  expect(html).toMatch(new RegExp(classAttrSource(className)));
}

export function tagWithClassPattern(
  tagName: string,
  className: string,
): RegExp {
  return new RegExp(
    `<${escapeRegExp(tagName)}\\b(?=[^>]*${classAttrSource(className)})[^>]*>`,
  );
}

export function expectHtmlTagWithClass(
  html: string,
  tagName: string,
  className: string,
): void {
  expect(html).toMatch(tagWithClassPattern(tagName, className));
}

export function getAttrValue(tagHtml: string, name: string): string | null {
  const match = tagHtml.match(
    new RegExp(
      `\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    ),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

export function findTagWithAttr(
  html: string,
  tagName: string,
  name: string,
  value: string,
): string | null {
  return html.match(tagWithAttrPattern(tagName, name, value))?.[0] ?? null;
}

export function expectHtmlLink(
  html: string,
  href: string,
  text: string,
): void {
  expect(html).toMatch(
    new RegExp(
      `<a\\b(?=[^>]*${attrSource("href", href)})[^>]*>${escapeRegExp(text)}</a>`,
    ),
  );
}
