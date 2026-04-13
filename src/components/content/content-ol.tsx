type Props = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
};

// 2em indent: enough room for 2-digit markers like "66." (#244)
export function ContentOl({ children, className, ...rest }: Props) {
  return (
    <ol
      className={`list-decimal${className ? ` ${className}` : ''}`}
      style={{ paddingLeft: '2em' }}
      {...rest}
    >
      {children}
    </ol>
  );
}
