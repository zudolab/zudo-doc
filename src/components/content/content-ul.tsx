type Props = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
};

// +4px nudge: hsp-xl (24px) is slightly too tight for disc/decimal markers (#222)
export function ContentUl({ children, className, ...rest }: Props) {
  return (
    <ul
      className={`list-disc pl-[calc(var(--spacing-hsp-xl)+4px)]${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </ul>
  );
}
