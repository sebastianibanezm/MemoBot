"use client";

import { NEON_COLORS, NEON_COLOR_KEYS, type NeonColorKey } from "@/lib/constants/colors";

interface ColorPickerProps {
  value: NeonColorKey;
  onChange: (color: NeonColorKey) => void;
  size?: "sm" | "md";
}

export function ColorPicker({ value, onChange, size = "md" }: ColorPickerProps) {
  const sizeClass = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  const gapClass = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <div className={`flex flex-wrap ${gapClass}`}>
      {NEON_COLOR_KEYS.map((colorKey) => {
        const color = NEON_COLORS[colorKey];
        const isSelected = value === colorKey;

        return (
          <button
            key={colorKey}
            type="button"
            onClick={() => onChange(colorKey)}
            className={`${sizeClass} rounded-full transition-all duration-200 border-2 ${
              isSelected
                ? "border-white scale-110"
                : "border-transparent hover:scale-105"
            }`}
            style={{
              backgroundColor: color.hex,
              boxShadow: isSelected ? `0 0 12px ${color.glow}` : "none",
            }}
            title={color.name}
            aria-label={`Select ${color.name} color`}
          />
        );
      })}
    </div>
  );
}
