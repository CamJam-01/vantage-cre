'use client';

import { forwardRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, id, className, error, type = 'text', style, disabled, ...rest },
  ref
) {
  const isPassword = type === 'password';

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isPassword ? (
        <PasswordInput
          ref={ref}
          id={id}
          className={className}
          style={style}
          disabled={disabled}
          {...rest}
        />
      ) : (
        <input
          ref={ref}
          id={id}
          type={type}
          disabled={disabled}
          className={['input', className].filter(Boolean).join(' ')}
          style={style}
          {...rest}
        />
      )}
      {error && <div className="record-error" style={{ marginTop: 4 }}>{error}</div>}
    </div>
  );
});

const toggleButtonStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  color: 'var(--color-neutral-600)',
};

const PasswordInput = forwardRef<HTMLInputElement, Omit<FieldProps, 'label' | 'error' | 'type'>>(
  function PasswordInput({ id, className, style, disabled, ...rest }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={['input', className].filter(Boolean).join(' ')}
          style={{ ...style, paddingRight: 36 }}
          {...rest}
        />
        <Button
          type="button"
          variant="icon"
          className="btn-ghost"
          disabled={disabled}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible(v => !v)}
          style={toggleButtonStyle}
        >
          {visible ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </Button>
      </div>
    );
  }
);
