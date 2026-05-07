export function FormField({
  label,
  type = "text",
  value,
  placeholder,
  onChange,
  full = false,
}: {
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={`form-field${full ? " full" : ""}`}>
      <label className="form-label">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
