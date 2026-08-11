import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', block, className, ...rest },
  ref
) {
  const classes = ['btn', `btn-${variant}`, block ? 'btn-block' : '', className].filter(Boolean).join(' ');
  return <button ref={ref} className={classes} {...rest} />;
});
