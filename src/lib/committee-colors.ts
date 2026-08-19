export const committeeColors = [
  { value: "#003C71", label: "Ontario Tech blue" },
  { value: "#0077CA", label: "Bright blue" },
  { value: "#E75D2A", label: "Ontario Tech orange" },
  { value: "#00843D", label: "Green" },
  { value: "#6F2C91", label: "Purple" },
  { value: "#007F86", label: "Teal" },
] as const;

export const committeeColorValues = committeeColors.map((color) => color.value) as [
  string,
  ...string[],
];

export function committeeColor(value: string | null | undefined) {
  return committeeColors.some((color) => color.value === value) ? value! : committeeColors[0].value;
}
