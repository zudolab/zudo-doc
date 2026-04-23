import { SmartBreak as SmartBreakBase } from '../../utils/smart-break';

// SmartBreak is defined with Preact's VNode return type, but content
// components type children as React.ReactNode. Cast to a React-compatible
// signature; at runtime Preact compat unifies the two.
const SmartBreak = SmartBreakBase as unknown as (props: {
  children?: React.ReactNode;
}) => React.ReactElement;

type Props = {
  href?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ContentLink({ href, className, children, ...rest }: Props) {
  // Block links and hash-links (heading anchors) should render without content link styling
  const classes = className ? className.split(' ') : [];
  if (classes.includes('block') || classes.includes('hash-link')) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }

  const content =
    typeof children === 'string' ? <SmartBreak>{children}</SmartBreak> : children;

  return (
    <a
      href={href}
      className={`text-accent underline hover:text-accent-hover${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {content}
    </a>
  );
}
