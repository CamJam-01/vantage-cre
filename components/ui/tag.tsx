import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type TagVariant = 'accent' | 'accent-2' | 'neutral' | 'outline';

type TagProps = {
  variant?: TagVariant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Tag({ variant, children, className, onClick, ...rest }: TagProps) {
  const classes = ['tag', variant ? `tag-${variant}` : '', className].filter(Boolean).join(' ');
  if (!onClick) return <span className={classes}>{children}</span>;
  return (
    <button type="button" className={classes} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
