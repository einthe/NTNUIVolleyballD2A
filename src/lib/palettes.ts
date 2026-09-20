export const palettes = {
  ntnui: { label: "NTNUI", background: "#101411", accent: "#c7df89" },
  petrol: { label: "Petrol", background: "#0c191e", accent: "#8ad9d4" },
  midnight: { label: "Nattblå", background: "#111624", accent: "#aac6ff" },
  plum: { label: "Plomme", background: "#1c1420", accent: "#ddafe4" },
} as const;
export type Palette = keyof typeof palettes;
export const paletteStorageKey = "ntnui-palette";
export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && Object.hasOwn(palettes, value);
}
// Static application constants only; never interpolate user content into this script.
export const paletteInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(paletteStorageKey)});if(${JSON.stringify(Object.keys(palettes))}.includes(p)){document.documentElement.dataset.palette=p;}}catch(e){}})();`;
