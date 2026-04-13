type Props = {
  href?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ContentLink({ href, className, children, ...rest }: Props) {
  // Block links should render without content link styling
  if (className && className.split(' ').includes('block')) {
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
