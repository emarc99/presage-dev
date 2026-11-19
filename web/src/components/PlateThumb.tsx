interface PlateThumbProps {
  sceneIndex: number;
}

export function PlateThumb({ sceneIndex }: PlateThumbProps) {
  if (sceneIndex === 0) {
    // I. Morning Steam
    return (
      <svg viewBox="0 0 200 130" className="w-full h-full block">
        <rect width="200" height="130" fill="var(--bg)" />
        <g stroke="var(--line)" strokeWidth="2">
          <line x1="20" y1="22" x2="180" y2="22" />
          <line x1="20" y1="36" x2="180" y2="36" />
          <line x1="20" y1="50" x2="180" y2="50" />
        </g>
        <path
          d="M74,76 L126,76 L120,114 C119,118 81,118 80,114 Z"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="2"
        />
        <path d="M124,84 C138,84 138,104 122,104" fill="none" stroke="var(--ink)" strokeWidth="2" />
        <path
          d="M90,66 C82,52 98,42 90,28"
          fill="none"
          stroke="var(--pop2)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M110,66 C102,52 118,40 110,24"
          fill="none"
          stroke="var(--pop)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (sceneIndex === 1) {
    // II. The Last Train North
    return (
      <svg viewBox="0 0 200 130" className="w-full h-full block">
        <rect width="200" height="130" fill="var(--scene-sky-top)" />
        <rect
          x="24"
          y="18"
          width="152"
          height="94"
          rx="14"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="2.2"
        />
        <circle cx="100" cy="60" r="22" fill="var(--bg)" stroke="var(--pop)" strokeWidth="2" />
        <line x1="100" y1="60" x2="96" y2="47" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="60" x2="112" y2="68" stroke="var(--pop2)" strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="96" x2="166" y2="96" stroke="var(--line)" strokeWidth="2" />
      </svg>
    );
  }

  if (sceneIndex === 2) {
    // III. The Empty Desk
    return (
      <svg viewBox="0 0 200 130" className="w-full h-full block">
        <rect width="200" height="130" fill="var(--bg)" />
        <polygon points="78,42 36,112 128,112" fill="var(--pop2-soft)" />
        <path
          d="M148,112 L126,38 L78,42"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="78" cy="42" r="8" fill="var(--pop2)" />
        <rect
          x="44"
          y="102"
          width="66"
          height="10"
          rx="2"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (sceneIndex === 3) {
    // IV. Two Chairs
    return (
      <svg viewBox="0 0 200 130" className="w-full h-full block">
        <rect width="200" height="130" fill="var(--bg)" />
        <line x1="100" y1="0" x2="100" y2="30" stroke="var(--ink)" strokeWidth="1.6" />
        <circle cx="100" cy="36" r="9" fill="var(--pop)" />
        <path
          d="M46,66 L46,110 M46,88 L76,88 L76,110"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M154,66 L154,110 M154,88 L124,88 L124,110"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // V. Open Doorway
  return (
    <svg viewBox="0 0 200 130" className="w-full h-full block">
      <rect width="200" height="130" fill="var(--scene-struct)" />
      <polygon points="74,20 120,20 170,130 50,130" fill="var(--pop-soft)" />
      <rect x="74" y="20" width="46" height="84" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.8" />
      <polygon points="74,20 100,28 100,112 74,104" fill="var(--pop)" />
    </svg>
  );
}
