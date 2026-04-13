type Props = {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
};

// 2em indent: enough room for 2-digit markers like "66." (#244)
export function ContentUl({ children, className, ...rest }: Props) {
  return (
    <ul
      className={`list-disc${className ? ` ${className}` : ''}`}
      style={{ paddingLeft: '2em' }}
      {...rest}
    >
      {children}
    </ul>
  );
}
