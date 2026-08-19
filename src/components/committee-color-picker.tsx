import { committeeColors } from "@/lib/committee-colors";

export function CommitteeColorPicker({
  defaultValue = committeeColors[0].value,
  compact = false,
}: {
  defaultValue?: string;
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-slate-600">Committee colour</legend>
      <div className="flex flex-wrap gap-2">
        {committeeColors.map((color) => (
          <label key={color.value} className="cursor-pointer" title={color.label}>
            <input
              type="radio"
              name="color"
              value={color.value}
              defaultChecked={color.value === defaultValue}
              className="peer sr-only"
            />
            <span
              className={`block rounded-full border-2 border-white shadow-sm outline outline-1 outline-slate-300 transition peer-checked:outline-4 peer-checked:outline-[#0077CA] ${compact ? "size-7" : "size-9"}`}
              style={{ backgroundColor: color.value }}
            >
              <span className="sr-only">{color.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
