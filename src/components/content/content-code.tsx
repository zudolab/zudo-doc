import { SmartBreak as SmartBreakImpl } from '@/utils/smart-break';

// Preact VNode vs React.ReactNode type mismatch under compat mode; cast so the
// content override type-checks. Runtime is fine since @astrojs/preact compat is on.
const SmartBreak = SmartBreakImpl as unknown as (props: {
  children?: unknown;
}) => any;

type Props = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
};

/**
 * Override for inline `<code>` in MDX. Wraps text-only inline code with
 * <SmartBreak> so that path/URL-like strings (e.g. `src/foo/bar.ts`) can
 * break at delimiters on narrow viewports.
 *
 * Block code inside a fenced block is processed by Shiki, which emits a
 * <code> element with class "language-*" containing a tree of <span>
 * nodes (not a plain string). We detect those and render untouched so
 * syntax highlighting is never disturbed.
 */
export function ContentCode({ children, className, ...rest }: Props) {
  const isShikiBlock =
    typeof className === 'string' && /(^|\s)language-/.test(className);
  const isInlineText = typeof children === 'string';

  if (isShikiBlock || !isInlineText) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <code className={className} {...rest}>
      <SmartBreak>{children}</SmartBreak>
    </code>
  );
}
