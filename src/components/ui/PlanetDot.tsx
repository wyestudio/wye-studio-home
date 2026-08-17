const PLANET_GRADIENTS = {
  mercury: "radial-gradient(circle at 32% 30%, #d8d2c8, #8c8478 75%)",
  venus: "radial-gradient(circle at 32% 30%, #f3dfae, #c99a4a 75%)",
  earth: "radial-gradient(circle at 32% 30%, #8fd0ef, #2f6a97 75%)",
  mars: "radial-gradient(circle at 32% 30%, #e8977a, #a8431f 75%)",
} as const;

export type Planet = keyof typeof PLANET_GRADIENTS;

export function PlanetDot({ planet, className = "" }: { planet: Planet; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block h-4 w-4 shrink-0 rounded-full shadow-[0_0_6px_-1px_rgba(255,255,255,0.5)] ${className}`}
      style={{ background: PLANET_GRADIENTS[planet] }}
    />
  );
}
