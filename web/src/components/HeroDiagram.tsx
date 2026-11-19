export function ApertureHeroSvg() {
  return (
    <svg
      viewBox="0 0 460 400"
      className="w-full max-w-md"
      role="img"
      aria-label="Optical aperture and breath resonance diagram"
    >
      <defs>
        <radialGradient id="heroGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--pop)" stopOpacity="0.22" />
          <stop offset="60%" stopColor="var(--pop2)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--pop)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="230" cy="200" r="185" fill="url(#heroGlowGrad)" />
      <circle
        cx="230"
        cy="200"
        r="168"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="4 6"
      />
      <circle
        cx="230"
        cy="200"
        r="138"
        fill="none"
        stroke="var(--pop)"
        strokeWidth="1.2"
        opacity="0.38"
        className="anim-breath-ring"
      />
      <circle
        cx="230"
        cy="200"
        r="108"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1"
        opacity="0.25"
      />

      <g stroke="var(--ink)" strokeWidth="1.35" opacity="0.82" fill="none">
        <line x1="230" y1="62" x2="312" y2="154" />
        <line x1="348" y1="131" x2="292" y2="236" />
        <line x1="348" y1="269" x2="218" y2="282" />
        <line x1="230" y1="338" x2="148" y2="246" />
        <line x1="112" y1="269" x2="168" y2="164" />
        <line x1="112" y1="131" x2="242" y2="118" />
      </g>

      <path
        d="M142,200 Q230,138 318,200 Q230,262 142,200 Z"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="1.8"
      />
      <circle cx="230" cy="200" r="34" fill="var(--pop)" />
      <circle cx="230" cy="200" r="14" fill="var(--bg)" />
      <circle cx="241" cy="189" r="5" fill="var(--pop2)" />

      <path
        d="M55,342 C115,342 135,310 185,310 C235,310 250,358 300,358 C345,358 365,332 405,332"
        fill="none"
        stroke="var(--pop2)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="185" cy="310" r="4" fill="var(--pop)" />
      <circle cx="300" cy="358" r="4" fill="var(--pop2)" />
    </svg>
  );
}

export function SignalArchitectureSvg() {
  return (
    <svg
      viewBox="0 0 1120 230"
      className="w-full"
      role="img"
      aria-label="4-step SmartSpectra signal flow diagram"
    >
      <path
        d="M235,84 C272,84 278,84 315,84"
        fill="none"
        stroke="var(--pop)"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <path
        d="M515,84 C552,84 558,84 595,84"
        fill="none"
        stroke="var(--pop)"
        strokeWidth="2"
        strokeDasharray="5 5"
      />
      <path
        d="M795,84 C832,84 838,84 875,84"
        fill="none"
        stroke="var(--pop2)"
        strokeWidth="2"
        strokeDasharray="5 5"
      />

      {/* Step 1: Natural Blink */}
      <g transform="translate(20,20)">
        <rect
          x="0"
          y="0"
          width="215"
          height="190"
          rx="16"
          fill="var(--bg)"
          stroke="var(--line)"
          strokeWidth="1.2"
        />
        <circle cx="36" cy="36" r="14" fill="var(--pop-soft)" />
        <text x="36" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pop)">
          01
        </text>
        <path
          d="M76,72 Q122,44 168,72 Q122,100 76,72 Z"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.8"
        />
        <line
          x1="88"
          y1="88"
          x2="156"
          y2="56"
          stroke="var(--pop2)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <text x="20" y="132" fontSize="15" fontWeight="600" fill="var(--ink)">
          Natural Blink
        </text>
        <text x="20" y="154" fontSize="12" fill="var(--ink-muted)">
          Cuts to the next memory
        </text>
        <text x="20" y="172" fontSize="12" fill="var(--ink-muted)">
          beat at &lt;60ms response.
        </text>
      </g>

      {/* Step 2: Gaze L / C / R */}
      <g transform="translate(300,20)">
        <rect
          x="0"
          y="0"
          width="215"
          height="190"
          rx="16"
          fill="var(--bg)"
          stroke="var(--line)"
          strokeWidth="1.2"
        />
        <circle cx="36" cy="36" r="14" fill="var(--pop-soft)" />
        <text x="36" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pop)">
          02
        </text>
        <polygon points="122,94 84,48 112,48" fill="var(--line)" />
        <polygon points="122,94 114,42 142,42" fill="var(--pop)" opacity="0.32" />
        <polygon points="122,94 144,48 172,48" fill="var(--line)" />
        <circle cx="122" cy="94" r="6" fill="var(--pop)" />
        <text x="20" y="132" fontSize="15" fontWeight="600" fill="var(--ink)">
          Gaze L / C / R
        </text>
        <text x="20" y="154" fontSize="12" fill="var(--ink-muted)">
          Iris landmarks shift scene
        </text>
        <text x="20" y="172" fontSize="12" fill="var(--ink-muted)">
          parallax &amp; focal plane.
        </text>
      </g>

      {/* Step 3: Steady Breath */}
      <g transform="translate(580,20)">
        <rect
          x="0"
          y="0"
          width="215"
          height="190"
          rx="16"
          fill="var(--bg)"
          stroke="var(--line)"
          strokeWidth="1.2"
        />
        <circle cx="36" cy="36" r="14" fill="var(--pop2-soft)" />
        <text x="36" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pop2)">
          03
        </text>
        <path
          d="M62,74 L74,56 L84,88 L96,62 L112,74 C126,74 134,58 148,58 C162,58 170,86 186,86"
          fill="none"
          stroke="var(--pop2)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <text x="20" y="132" fontSize="15" fontWeight="600" fill="var(--ink)">
          Steady Breath
        </text>
        <text x="20" y="154" fontSize="12" fill="var(--ink-muted)">
          4.5s chest trace clears
        </text>
        <text x="20" y="172" fontSize="12" fill="var(--ink-muted)">
          haze &amp; unlocks marginalia.
        </text>
      </g>

      {/* Step 4: Afterimage Print */}
      <g transform="translate(860,20)">
        <rect
          x="0"
          y="0"
          width="240"
          height="190"
          rx="16"
          fill="var(--bg)"
          stroke="var(--line)"
          strokeWidth="1.2"
        />
        <circle cx="36" cy="36" r="14" fill="var(--pop-soft)" />
        <text x="36" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--pop)">
          04
        </text>
        <rect
          x="74"
          y="46"
          width="24"
          height="34"
          rx="3"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="1.3"
        />
        <rect x="104" y="46" width="24" height="34" rx="3" fill="var(--pop)" />
        <rect
          x="134"
          y="46"
          width="24"
          height="34"
          rx="3"
          fill="var(--surface)"
          stroke="var(--ink)"
          strokeWidth="1.3"
        />
        <rect x="164" y="46" width="24" height="34" rx="3" fill="var(--pop2)" />
        <text x="20" y="132" fontSize="15" fontWeight="600" fill="var(--ink)">
          Afterimage Print
        </text>
        <text x="20" y="154" fontSize="12" fill="var(--ink-muted)">
          Exports a 5-frame PNG
        </text>
        <text x="20" y="172" fontSize="12" fill="var(--ink-muted)">
          keepsake of your sitting.
        </text>
      </g>
    </svg>
  );
}
