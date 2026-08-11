import { type ElementType, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type BlueprintProps<T extends ElementType> = {
  as?: T;
  elevation?: 'sm' | 'md' | 'lg';
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

export function Blueprint<T extends ElementType = 'div'>({
  as, elevation, className, children, ...rest
}: BlueprintProps<T>) {
  const Tag = as || 'div';
  const classes = ['blueprint', elevation ? `elev-${elevation}` : '', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
