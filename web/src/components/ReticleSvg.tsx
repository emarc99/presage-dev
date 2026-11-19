import type { GazeZone, SilhouettePoint } from '../types/signals';

interface ReticleSvgProps {
  silhouette: SilhouettePoint[] | null;
  gaze: GazeZone;
  faceDetected: boolean;
  breathSteadiness: number;
}

export function ReticleSvg({
  silhouette,
  gaze,
  faceDetected,
  breathSteadiness,
}: ReticleSvgProps) {
  const gazeShift = gaze === 'left' ? -10 : gaze === 'right' ? 10 : 0;

  // Map 36 normalized [0..1] face oval points into center reticle box when streaming live
  const livePath =
    silhouette && silhouette.length > 6
      ? silhouette
          .map((pt, idx) => {
            const x = 198 + pt.x * 104;
            const y = 96 + pt.y * 150;
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ') + ' Z'
      : null;

  return (
    <svg
      viewBox="0 0 500 380"
      className="w-full rounded-xl"
      style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
      role="img"
      aria-label="Precision rangefinder alignment vector reticle"
    >
      {/* Corner crop brackets */}
      <g stroke="var(--ink-muted)" strokeWidth="1.5" fill="none" opacity="0.55">
        <path d="M36,60 L36,34 L62,34" />
        <path d="M438,34 L464,34 L464,60" />
        <path d="M36,320 L36,346 L62,346" />
        <path d="M438,346 L464,346 L464,320" />
      </g>

      {/* Rangefinder concentric optics */}
      <circle cx="250" cy="175" r="126" fill="none" stroke="var(--line)" strokeWidth="1" />
      <circle
        cx="250"
        cy="175"
        r={102 + Math.round((breathSteadiness / 100) * 10)}
        fill="none"
        stroke="var(--pop)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        className="anim-breath-ring"
      />
      <line x1="100" y1="175" x2="128" y2="175" stroke="var(--ink-muted)" strokeWidth="1" />
      <line x1="372" y1="175" x2="400" y2="175" stroke="var(--ink-muted)" strokeWidth="1" />

      {/* Head oval: live SmartSpectra outline when available, else serene calibrated guide */}
      {livePath ? (
        <path
          d={livePath}
          fill="var(--surface)"
          stroke={faceDetected ? 'var(--pop)' : 'var(--ink)'}
          strokeWidth="2"
        />
      ) : (
        <path
          d="M204,132 C204,98 296,98 296,132 L296,184 C296,222 272,244 250,244 C228,244 204,222 204,184 Z"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="1.8"
        />
      )}

      {/* Bilateral eye arches with live L/C/R iris indicator */}
      <path
        d="M218,162 Q231,152 244,162 Q231,170 218,162 Z"
        fill="var(--pop-soft)"
        stroke="var(--pop)"
        strokeWidth="1.4"
      />
      <circle cx={231 + gazeShift * 0.45} cy="162" r="3.4" fill="var(--pop)" />

      <path
        d="M256,162 Q269,152 282,162 Q269,170 256,162 Z"
        fill="var(--pop-soft)"
        stroke="var(--pop)"
        strokeWidth="1.4"
      />
      <circle cx={269 + gazeShift * 0.45} cy="162" r="3.4" fill="var(--pop)" />

      {/* Shoulder & chest horizon */}
      <path
        d="M138,334 C156,282 198,266 250,266 C302,266 344,282 362,334"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M180,312 Q250,286 320,312"
        fill="none"
        stroke="var(--pop2)"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="anim-breath-ring"
      />
      <text x="250" y="352" textAnchor="middle" fontSize="12" fill="var(--ink-muted)">
        {livePath
          ? 'Live SmartSpectra contour (no video frames leave native host)'
          : 'Keep shoulders & upper chest visible below chin'}
      </text>
    </svg>
  );
}
