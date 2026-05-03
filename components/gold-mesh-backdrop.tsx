"use client"

type Variant = "landing" | "login"

/** CSS-only hero backdrop (replaces missing /bed-plate-bg.png — next/image 500s on SSR if file absent). */
export function GoldMeshBackdrop({ variant = "landing" }: { variant?: Variant }) {
  const motion =
    variant === "landing"
      ? "scale-105 animate-[float_20s_ease-in-out_infinite]"
      : "scale-105"

  return (
    <div
      className={`absolute inset-0 z-0 overflow-hidden ${motion}`}
      aria-hidden
    >
      <div
        className={`absolute inset-0 ${variant === "landing" ? "opacity-[0.55]" : "opacity-[0.35]"}`}
        style={{
          background: `
            radial-gradient(ellipse 85% 55% at 50% 0%, rgba(212, 175, 55, 0.38), transparent 55%),
            radial-gradient(ellipse 50% 40% at 92% 28%, rgba(243, 207, 122, 0.18), transparent),
            radial-gradient(ellipse 45% 50% at 8% 72%, rgba(179, 136, 34, 0.22), transparent),
            linear-gradient(to bottom, #1a1510 0%, #0f1110 55%, #0a0b0a 100%)
          `,
        }}
      />
    </div>
  )
}
