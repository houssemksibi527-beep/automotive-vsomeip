// Hand-drawn SVG nodes, centered on the origin (parent <g> positions them).
// Playful, rounded, brand colours — matching the zelos poster feel.

const INK = "#0E1F3A";

export function LidarArt({ active }: { active: boolean }) {
  const accent = active ? "#1FBD55" : "#C7D0DD";
  return (
    <g>
      <defs>
        <linearGradient id="lidarSweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2FCB66" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#2FCB66" stopOpacity="0" />
        </linearGradient>
      </defs>

      {active && (
        <circle r={58} fill="none" stroke="#1FBD55" strokeWidth={3}>
          <animate attributeName="r" from={56} to={104} dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" from={0.5} to={0} dur="2.6s" repeatCount="indefinite" />
        </circle>
      )}

      {/* base puck */}
      <circle r={56} fill="#FFFFFF" stroke={INK} strokeWidth={8} />
      <circle r={44} fill="#F8F9FB" stroke="#EEF1F6" strokeWidth={2} />

      {/* rotating sweep */}
      <g>
        <path d="M0 0 L0 -46 A46 46 0 0 1 40 -23 Z" fill="url(#lidarSweep)">
          {active && (
            <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="2.8s" repeatCount="indefinite" />
          )}
        </path>
      </g>

      {/* beam ticks */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <circle key={a} cx={Math.cos(r) * 46} cy={Math.sin(r) * 46} r={2.6} fill={accent} />;
      })}

      {/* hub */}
      <circle r={9} fill={accent} stroke={INK} strokeWidth={3} />
    </g>
  );
}

export function SteeringArt({ active }: { active: boolean }) {
  const accent = active ? "#3D4FE5" : "#C7D0DD";
  const spokes = [90, 210, 330];
  return (
    <g>
      <g>
        {active && (
          <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="-360 0 0" dur="7s" repeatCount="indefinite" />
        )}
        {/* rim */}
        <circle r={56} fill="#FFFFFF" stroke={INK} strokeWidth={10} />
        <circle r={40} fill="none" stroke="#EEF1F6" strokeWidth={4} />
        {/* spokes */}
        {spokes.map((a) => {
          const r = (a * Math.PI) / 180;
          return (
            <line key={a} x1={0} y1={0} x2={Math.cos(r) * 50} y2={Math.sin(r) * 50} stroke={INK} strokeWidth={9} strokeLinecap="round" />
          );
        })}
        {/* grip nubs */}
        {[30, 150, 270].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={Math.cos(r) * 56} cy={Math.sin(r) * 56} r={6} fill={accent} />;
        })}
        {/* hub */}
        <circle r={16} fill={accent} stroke={INK} strokeWidth={4} />
      </g>
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
