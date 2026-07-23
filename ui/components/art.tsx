// Hand-drawn SVG nodes, centered on the origin (parent <g> positions them).
// Playful, rounded, brand colours — matching the zelos poster feel.

const INK = "#0E1F3A";

export function IVIArt({ active }: { active: boolean }) {
  const accent = active ? "#1FBD55" : "#C7D0DD";
  return (
    <g>
      {/* Outer Screen Bezel */}
      <rect x={-72} y={-48} width={144} height={96} rx={12} fill="#FFFFFF" stroke={INK} strokeWidth={8} />
      
      {/* Inner Screen Display */}
      <rect x={-60} y={-36} width={120} height={72} rx={6} fill={active ? "#E8F9EE" : "#F8F9FB"} stroke="#EEF1F6" strokeWidth={2} />

      {/* Dashboard UI Elements - App Grid & Media Player */}
      <rect x={-48} y={-24} width={40} height={48} rx={6} fill={accent} />
      <rect x={-2} y={-24} width={50} height={20} rx={4} fill={accent} opacity={0.5} />
      <rect x={-2} y={4} width={50} height={20} rx={4} fill={accent} opacity={0.8} />

      {/* Active Pulse Animation inside the UI */}
      {active && (
        <circle cx={-28} cy={0} r={10} fill="#FFFFFF">
          <animate attributeName="opacity" values="0.1;0.9;0.1" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

export function HPCArt({ active }: { active: boolean }) {
  const accent = active ? "#3D4FE5" : "#C7D0DD";
  return (
    <g>
      {/* External Pins (Microcontroller/ECU style) */}
      {[-32, -12, 8, 28].map((pos) => (
        <g key={pos}>
          {/* Top */}
          <line x1={pos + 2} y1={-52} x2={pos + 2} y2={-64} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          {/* Bottom */}
          <line x1={pos + 2} y1={52} x2={pos + 2} y2={64} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          {/* Left */}
          <line x1={-52} y1={pos + 2} x2={-64} y2={pos + 2} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          {/* Right */}
          <line x1={52} y1={pos + 2} x2={64} y2={pos + 2} stroke={INK} strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}

      {/* Main CPU / ECU Housing */}
      <rect x={-52} y={-52} width={104} height={104} rx={16} fill="#FFFFFF" stroke={INK} strokeWidth={8} />
      
      {/* Inner Chip Die */}
      <rect x={-28} y={-28} width={56} height={56} rx={8} fill={active ? "#EEF1FF" : "#F8F9FB"} stroke="#EEF1F6" strokeWidth={2} />

      {/* Center Core */}
      <circle cx={0} cy={0} r={12} fill={accent} />

      {/* Data Lines / Traces connecting to the core */}
      <path d="M-14 -14 L-6 -6 M14 -14 L6 -6 M-14 14 L-6 6 M14 14 L6 6" stroke={accent} strokeWidth={4} strokeLinecap="round" />

      {/* Active Processing Ripple */}
      {active && (
        <circle cx={0} cy={0} r={12} fill="none" stroke={accent} strokeWidth={3}>
          <animate attributeName="r" from={12} to={26} dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from={0.8} to={0} dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

export function SwitchArt({ active }: { active: boolean }) {
  const accent = active ? "#3D4FE5" : "#C7D0DD";
  const led = active ? "#1FBD55" : "#DDE3EC";
  return (
    <g>
      {/* chassis */}
      <rect x={-92} y={-52} width={184} height={104} rx={20} fill="#FFFFFF" stroke={INK} strokeWidth={8} />
      <rect x={-92} y={-52} width={184} height={30} rx={20} fill={active ? "#EEF1FF" : "#F8F9FB"} />
      <rect x={-92} y={-30} width={184} height={8} fill="#F8F9FB" />

      {/* label dot + status LED */}
      <circle cx={-74} cy={-37} r={5} fill={accent} />
      <circle cx={74} cy={-37} r={6} fill={led} stroke={INK} strokeWidth={2} />

      {/* ports */}
      {[-66, -40, -14, 14, 40, 66].map((x, i) => (
        <rect key={x} x={x - 9} y={2} width={18} height={22} rx={4} fill={active && i % 2 === 0 ? "#EEF1FF" : "#F8F9FB"} stroke={INK} strokeWidth={3} />
      ))}

      {/* magnifier hint = "click to capture" */}
      <g transform="translate(58,-4)" opacity={active ? 0.9 : 0.35}>
        <circle r={12} fill="#FFFBF1" stroke={INK} strokeWidth={3} />
        <line x1={8} y1={8} x2={16} y2={16} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      </g>
    </g>
  );
}
