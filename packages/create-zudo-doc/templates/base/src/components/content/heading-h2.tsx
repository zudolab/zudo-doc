import type { CSSProperties } from 'react';
import type { ComponentChildren } from 'preact';

type Props = {
  id?: string;
  className?: string;
  children?: ComponentChildren;
  [key: string]: any;
};

export function HeadingH2({ id, children, className, ...rest }: Props) {
  return (
    <h2
      id={id}
      className={`text-title font-bold leading-tight pt-vsp-sm border-t-[3px] border-transparent${className ? ` ${className}` : ''}`}
      style={
        {
          borderImage: 'linear-gradient(to right, var(--color-fg), transparent) 1',
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </h2>
  );
}
