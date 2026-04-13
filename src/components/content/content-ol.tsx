type Props = {
  children?: React.ReactNode;
  [key: string]: any;
};

export function ContentOl({ children, ...rest }: Props) {
  return (
    <ol
      className="list-decimal pl-[calc(var(--spacing-hsp-xl)+4px)]"
      {...rest}
    >
      {children}
    </ol>
  );
}
