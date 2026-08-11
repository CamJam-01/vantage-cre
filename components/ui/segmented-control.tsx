type Option = { label: string; value: string };

type SegmentedControlProps = {
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

export function SegmentedControl({ name, options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="seg">
      {options.map(opt => (
        <label key={opt.value} className="seg-opt" style={{ width: '100%' }}>
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
