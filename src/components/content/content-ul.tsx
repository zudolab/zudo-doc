type Props = {
  children?: React.ReactNode;
  [key: string]: any;
};

export function ContentUl({ children, ...rest }: Props) {
  return (
    <ul
      className="list-disc pl-[calc(var(--spacing-hsp-xl)+4px)]"
      {...rest}
    >
      {children}
    </ul>
  );
}
