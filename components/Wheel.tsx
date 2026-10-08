/** A simple weighted spinner wheel: big slices for likely words. */
const SLICES = [
  { frac: 0.45, color: "#5b3cc4" },
  { frac: 0.22, color: "#2d7ff9" },
  { frac: 0.15, color: "#12a37f" },
  { frac: 0.1, color: "#ffb020" },
  { frac: 0.08, color: "#e4572e" },
];

const PATHS = (() => {
  let start = -Math.PI / 2;
  return SLICES.map(({ frac, color }) => {
    const end = start + frac * 2 * Math.PI;
    const [x1, y1] = [50 + 46 * Math.cos(start), 50 + 46 * Math.sin(start)];
    const [x2, y2] = [50 + 46 * Math.cos(end), 50 + 46 * Math.sin(end)];
    start = end;
    return {
      color,
      d: `M50 50 L${x1.toFixed(2)} ${y1.toFixed(2)} A46 46 0 ${frac > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z`,
    };
  });
})();

export default function Wheel({ spinning = false, className = "" }: { spinning?: boolean; className?: string }) {
  const paths = PATHS.map(({ color, d }) => (
    <path key={color} d={d} fill={color} stroke="#fff" strokeWidth="2" />
  ));
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <g className={spinning ? "animate-wheel" : ""} style={{ transformOrigin: "50px 50px" }}>
        {paths}
        <circle cx="50" cy="50" r="8" fill="#fff" />
      </g>
      <path d="M50 0 L56 12 L44 12Z" fill="#1d2433" />
    </svg>
  );
}
