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

  return (
    <a
      href={href}
      className={`text-accent underline hover:text-accent-hover${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </a>
  );
}
