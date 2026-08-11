import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, id, className, error, ...rest },
  ref
) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input ref={ref} id={id} className={['input', className].filter(Boolean).join(' ')} {...rest} />
      {error && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 4 }}>{error}</div>}
    </div>
  );
});
