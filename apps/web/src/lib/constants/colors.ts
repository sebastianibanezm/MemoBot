/** Neon color options for categories */
export const NEON_COLORS = {
  "neon-cyan": {
    name: "Cyan",
    hex: "#00FFFF",
    glow: "rgba(0, 255, 255, 0.5)",
  },
  "neon-pink": {
    name: "Pink",
    hex: "#FF10F0",
    glow: "rgba(255, 16, 240, 0.5)",
  },
  "neon-green": {
    name: "Green",
    hex: "#39FF14",
    glow: "rgba(57, 255, 20, 0.5)",
  },
  "neon-purple": {
    name: "Purple",
    hex: "#BF00FF",
    glow: "rgba(191, 0, 255, 0.5)",
  },
  "neon-yellow": {
    name: "Yellow",
    hex: "#FFFF00",
    glow: "rgba(255, 255, 0, 0.5)",
  },
  "neon-orange": {
    name: "Orange",
    hex: "#FF6600",
    glow: "rgba(255, 102, 0, 0.5)",
  },
  "neon-blue": {
    name: "Blue",
    hex: "#00BFFF",
    glow: "rgba(0, 191, 255, 0.5)",
  },
  "neon-red": {
    name: "Red",
    hex: "#FF3131",
    glow: "rgba(255, 49, 49, 0.5)",
  },
  "neon-lime": {
    name: "Lime",
    hex: "#CCFF00",
    glow: "rgba(204, 255, 0, 0.5)",
  },
  "neon-magenta": {
    name: "Magenta",
    hex: "#FF00FF",
    glow: "rgba(255, 0, 255, 0.5)",
  },
} as const;

export type NeonColorKey = keyof typeof NEON_COLORS;

export const NEON_COLOR_KEYS = Object.keys(NEON_COLORS) as NeonColorKey[];

/**
 * Get the hex color for a neon color key
 */
export function getNeonColorHex(colorKey: string): string {
  const color = NEON_COLORS[colorKey as NeonColorKey];
  return color?.hex ?? NEON_COLORS["neon-cyan"].hex;
}

/**
 * Get the glow color for a neon color key
 */
export function getNeonColorGlow(colorKey: string): string {
  const color = NEON_COLORS[colorKey as NeonColorKey];
  return color?.glow ?? NEON_COLORS["neon-cyan"].glow;
}
