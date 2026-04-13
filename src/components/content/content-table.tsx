type Props = {
  children?: React.ReactNode;
  [key: string]: any;
};

export function ContentTable({ children, ...rest }: Props) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse text-small"
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}
