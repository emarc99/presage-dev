import type { GazeZone, TonalEcho } from '../types/signals';

interface SceneArtProps {
  sceneIndex: number;
  gaze: GazeZone;
  breathSteadiness: number;
  echo: TonalEcho;
  parallaxOffset: number;
}

const PANES: Record<GazeZone, { x: number; w: number }> = {
  left: { x: 48, w: 334 },
  center: { x: 418, w: 364 },
  right: { x: 818, w: 334 },
};

export function SceneArt({
  sceneIndex,
  gaze,
  breathSteadiness,
  echo,
  parallaxOffset,
}: SceneArtProps) {
  const blurPx = Math.max(0, ((100 - breathSteadiness) / 100) * 6.2).toFixed(2);
  const gazeShift = gaze === 'left' ? 24 : gaze === 'right' ? -24 : 0;
  const activePane = PANES[gaze];

  const echoTint =
    echo === 'warm'
      ? 'rgba(249, 115, 22, 0.11)'
      : echo === 'heavy'
      ? 'rgba(15, 23, 42, 0.24)'
      : 'transparent';

  return (
    <svg
      viewBox="0 0 1200 540"
      className="w-full block"
      role="img"
      aria-label={`Scene ${sceneIndex + 1} interactive illustration`}
    >
      <defs>
        <linearGradient id={`sky-${sceneIndex}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--scene-sky-top)" />
          <stop offset="100%" stopColor="var(--scene-sky-bot)" />
        </linearGradient>
        <radialGradient id={`cone-${sceneIndex}`} cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="var(--scene-glow)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--scene-glow)" stopOpacity="0" />
        </radialGradient>
        <filter id={`blur-${sceneIndex}`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blurPx} />
        </filter>
      </defs>

      <g filter={`url(#blur-${sceneIndex})`}>
        <rect x="0" y="0" width="1200" height="540" fill={`url(#sky-${sceneIndex})`} />

        {/* SCENE 0: MORNING STEAM */}
        {sceneIndex === 0 && (
          <g>
            {/* Left: Slatted Venetian Blinds */}
            <g transform={`translate(${gazeShift * 0.4}, 0)`}>
              <rect
                x="72"
                y="62"
                width="280"
                height="278"
                rx="12"
                fill="var(--surface)"
                stroke="var(--line)"
                strokeWidth="2"
              />
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={i}
                  x1="88"
                  y1={86 + i * 27}
                  x2="336"
                  y2={86 + i * 27}
                  stroke="var(--scene-mid)"
                  strokeWidth="4"
                  opacity="0.35"
                />
              ))}
              <polygon
                points="90,340 340,340 430,435 165,435"
                fill="var(--pop-soft)"
                opacity="0.65"
              />
            </g>

            {/* Center: Ceramic Coffee Cup & Rising Steam */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <rect x="0" y="360" width="1200" height="180" fill="var(--surface-alt)" />
              <line x1="0" y1="360" x2="1200" y2="360" stroke="var(--line)" strokeWidth="2" />
              <ellipse cx="600" cy="378" rx="110" ry="18" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
              <path
                d="M526,272 L674,272 L658,368 C655,382 545,382 542,368 Z"
                fill="var(--surface)"
                stroke="var(--ink)"
                strokeWidth="3"
              />
              <path
                d="M672,292 C710,292 710,344 664,344"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="3"
              />
              <path
                d={`M568,252 C${548 + Math.sin(parallaxOffset * 0.05) * 14},210 594,175 568,125`}
                fill="none"
                stroke="var(--pop)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d={`M604,250 C${626 - Math.sin(parallaxOffset * 0.05) * 14},200 582,155 612,102`}
                fill="none"
                stroke="var(--pop2)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M634,255 C650,220 622,190 638,150"
                fill="none"
                stroke="var(--ink-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.5"
              />
            </g>

            {/* Right: Silver Spoon & Folded Napkin Note */}
            <g transform={`translate(${gazeShift * 0.4}, 0)`}>
              <polygon
                points="870,320 1075,305 1110,415 895,432"
                fill="var(--surface)"
                stroke="var(--ink)"
                strokeWidth="2.2"
              />
              <line x1="910" y1="352" x2="1038" y2="342" stroke="var(--pop)" strokeWidth="2.2" />
              <line x1="916" y1="376" x2="1012" y2="368" stroke="var(--ink-muted)" strokeWidth="2" opacity="0.6" />
              <line x1="922" y1="398" x2="986" y2="393" stroke="var(--pop2)" strokeWidth="2" opacity="0.8" />
              <ellipse cx="835" cy="356" rx="18" ry="10" fill="var(--line)" stroke="var(--ink)" strokeWidth="1.8" />
              <line x1="850" y1="360" x2="905" y2="395" stroke="var(--ink)" strokeWidth="3.2" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* SCENE 1: THE LAST TRAIN NORTH */}
        {sceneIndex === 1 && (
          <g>
            <circle cx="920" cy="115" r="42" fill="var(--scene-glow)" opacity="0.22" />
            <circle cx="920" cy="115" r="24" fill="var(--scene-glow)" opacity="0.65" />

            <g
              transform={`translate(${(gazeShift - parallaxOffset).toFixed(1)}, 0)`}
              fill="var(--scene-mid)"
              opacity="0.45"
            >
              <path d="M-120,380 L-120,275 L-45,275 L-45,310 L40,310 L40,225 L125,225 L125,295 L230,295 L230,250 L310,250 L310,335 L430,335 L430,210 L515,210 L515,305 L660,305 L660,240 L740,240 L740,325 L880,325 L880,220 L950,220 L950,295 L1085,295 L1085,245 L1210,245 L1210,380 Z" />
              <rect x="65" y="245" width="10" height="14" fill="var(--scene-glow)" opacity="0.8" />
              <rect x="455" y="232" width="12" height="18" fill="var(--scene-glow)" opacity="0.85" />
              <rect x="685" y="264" width="10" height="14" fill="var(--scene-accent)" opacity="0.85" />
              <rect x="905" y="242" width="14" height="14" fill="var(--scene-glow)" opacity="0.7" />
            </g>

            <rect x="0" y="348" width="1200" height="192" fill="var(--scene-struct)" opacity="0.32" />
            <g transform="translate(600, 212)">
              <line x1="0" y1="-150" x2="0" y2="-44" stroke="var(--scene-struct)" strokeWidth="5" />
              <circle cx="0" cy="0" r="46" fill="var(--surface)" stroke="var(--scene-struct)" strokeWidth="5" />
              <circle cx="0" cy="0" r="38" fill="none" stroke="var(--pop)" strokeWidth="1.5" strokeDasharray="2 8" />
              <line x1="0" y1="0" x2="-4" y2="-22" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
              <line x1="0" y1="0" x2="18" y2="21" stroke="var(--pop2)" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="0" cy="0" r="3.5" fill="var(--ink)" />
            </g>

            <g transform="translate(885, 222)">
              <line x1="35" y1="30" x2="35" y2="140" stroke="var(--scene-struct)" strokeWidth="6" />
              <line x1="215" y1="30" x2="215" y2="140" stroke="var(--scene-struct)" strokeWidth="6" />
              <rect x="0" y="-12" width="250" height="54" rx="6" fill="var(--surface)" stroke="var(--scene-struct)" strokeWidth="3" />
              <text x="125" y="16" textAnchor="middle" fontSize="14" fontWeight="700" letterSpacing="2" fill="var(--ink)">
                PLATFORM 04
              </text>
              <text x="125" y="32" textAnchor="middle" fontSize="11" fill="var(--pop2)">
                NORTHBOUND · LOCAL
              </text>
            </g>
          </g>
        )}

        {/* SCENE 2: THE EMPTY DESK */}
        {sceneIndex === 2 && (
          <g>
            {/* Left: Hallway Door Ajar & Hanging Scarf */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <rect x="74" y="64" width="160" height="334" fill="var(--surface-alt)" stroke="var(--ink)" strokeWidth="2.5" />
              <polygon points="74,64 180,88 180,378 74,398" fill="var(--pop-soft)" />
              <path d="M295,148 Q304,210 290,266" fill="none" stroke="var(--pop2)" strokeWidth="8" strokeLinecap="round" />
              <circle cx="295" cy="144" r="6" fill="var(--ink)" />
            </g>

            {/* Center: Architect Lamp & Open Ruled Notebook */}
            <g transform={`translate(${gazeShift * 0.2}, 0)`}>
              <rect x="0" y="378" width="1200" height="162" fill="var(--scene-struct)" opacity="0.22" />
              <polygon points="560,150 400,398 730,398" fill={`url(#cone-${sceneIndex})`} />
              <path d="M740,392 L675,180 L560,150" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" />
              <rect x="708" y="384" width="64" height="12" rx="4" fill="var(--ink)" />
              <path d="M538,142 L584,142 L570,168 L552,168 Z" fill="var(--pop)" />
              {/* Open notebook */}
              <rect x="466" y="330" width="210" height="58" rx="4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.2" />
              <line x1="571" y1="330" x2="571" y2="388" stroke="var(--line)" strokeWidth="2" />
              <line x1="486" y1="348" x2="552" y2="348" stroke="var(--pop)" strokeWidth="2" />
              <line x1="486" y1="364" x2="546" y2="364" stroke="var(--ink-muted)" strokeWidth="1.5" />
              <line x1="588" y1="348" x2="652" y2="348" stroke="var(--ink-muted)" strokeWidth="1.5" />
              {/* Pen */}
              <line x1="692" y1="368" x2="736" y2="344" stroke="var(--pop2)" strokeWidth="3.5" strokeLinecap="round" />
            </g>

            {/* Right: Tall Night Window & Rooftop Beacons */}
            <g transform={`translate(${gazeShift * 0.35}, 0)`}>
              <rect x="850" y="64" width="270" height="270" rx="10" fill="var(--scene-struct)" stroke="var(--line)" strokeWidth="3" />
              <line x1="985" y1="64" x2="985" y2="334" stroke="var(--line)" strokeWidth="2.5" />
              <line x1="850" y1="198" x2="1120" y2="198" stroke="var(--line)" strokeWidth="2.5" />
              <circle cx="912" cy="142" r="5" fill="var(--pop2)" />
              <circle cx="1055" cy="112" r="4" fill="var(--pop)" />
              <path d="M852,334 L852,258 L920,258 L920,295 L1015,295 L1015,240 L1118,240 L1118,334 Z" fill="var(--scene-mid)" opacity="0.6" />
            </g>
          </g>
        )}

        {/* SCENE 3: TWO CHAIRS */}
        {sceneIndex === 3 && (
          <g>
            <rect x="0" y="388" width="1200" height="152" fill="var(--surface-alt)" />
            <line x1="0" y1="388" x2="1200" y2="388" stroke="var(--line)" strokeWidth="2" />

            {/* Left Timber Chair angled slightly inward */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <path
                d="M175,180 L195,418 M288,295 L292,418 M185,298 L292,292 M168,180 L232,180"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="172" y="182" width="58" height="44" rx="4" fill="var(--pop-soft)" stroke="var(--ink)" strokeWidth="2.5" />
            </g>

            {/* Center Hanging Pendant Sphere & Warm Floor Glow */}
            <g transform={`translate(${gazeShift * 0.15}, 0)`}>
              <polygon points="600,148 410,418 790,418" fill={`url(#cone-${sceneIndex})`} />
              <line x1="600" y1="0" x2="600" y2="116" stroke="var(--ink)" strokeWidth="2.5" />
              <circle cx="600" cy="144" r="32" fill="var(--surface)" stroke="var(--pop)" strokeWidth="3" />
              <circle cx="600" cy="144" r="14" fill="var(--pop2)" opacity="0.7" />
              <ellipse cx="600" cy="404" rx="145" ry="18" fill="var(--pop-soft)" />
            </g>

            {/* Right Chair + Side Table & Water Glass */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <path
                d="M1045,180 L1025,418 M932,295 L928,418 M1035,298 L928,292 M988,180 L1052,180"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Side table + water glass */}
              <rect x="835" y="318" width="90" height="8" rx="3" fill="var(--ink)" />
              <line x1="880" y1="326" x2="880" y2="414" stroke="var(--ink)" strokeWidth="4" />
              <path d="M864,274 L896,274 L891,316 L869,316 Z" fill="var(--pop-soft)" stroke="var(--pop)" strokeWidth="2" />
              <line x1="867" y1="292" x2="893" y2="292" stroke="var(--pop2)" strokeWidth="2" />
            </g>
          </g>
        )}

        {/* SCENE 4: OPEN DOORWAY */}
        {sceneIndex === 4 && (
          <g>
            {/* Dark interior room around daylight doorway */}
            <rect x="0" y="0" width="1200" height="540" fill="var(--scene-struct)" opacity="0.82" />

            {/* Left: Stacked Moving Boxes along Baseboard */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <rect x="105" y="292" width="150" height="115" fill="var(--surface)" stroke="var(--line)" strokeWidth="2.5" />
              <rect x="135" y="196" width="118" height="96" fill="var(--surface-alt)" stroke="var(--line)" strokeWidth="2.5" />
              <line x1="180" y1="292" x2="180" y2="335" stroke="var(--pop2)" strokeWidth="6" />
              <line x1="194" y1="196" x2="194" y2="232" stroke="var(--pop)" strokeWidth="5" />
            </g>

            {/* Center: Tall Threshold Doorway & Floor Sunbeam Trapezoid */}
            <g transform={`translate(${gazeShift * 0.2}, 0)`}>
              <polygon points="495,56 705,56 890,540 310,540" fill="var(--pop-soft)" />
              <rect x="495" y="56" width="210" height="352" fill={`url(#sky-${sceneIndex})`} stroke="var(--surface)" strokeWidth="4" />
              {/* Half-open wooden door leaf */}
              <polygon points="495,56 602,94 602,436 495,408" fill="var(--pop)" opacity="0.92" />
              <circle cx="585" cy="252" r="5" fill="var(--pop-contrast)" />
            </g>

            {/* Right: Exterior Porch Glass Lantern */}
            <g transform={`translate(${gazeShift * 0.25}, 0)`}>
              <rect x="920" y="128" width="110" height="160" rx="55" fill="var(--surface)" opacity="0.16" />
              <path d="M975,86 L975,134" stroke="var(--surface)" strokeWidth="3" />
              <polygon points="948,142 1002,142 992,202 958,202" fill="var(--pop2)" opacity="0.88" stroke="var(--surface)" strokeWidth="2" />
              <circle cx="975" cy="172" r="14" fill="var(--surface)" opacity="0.85" />
            </g>
          </g>
        )}
      </g>

      {/* Atmospheric Rain ONLY on Scene 1 (Last Train) & Scene 2 (Desk Window) */}
      {(sceneIndex === 1 || sceneIndex === 2) && (
        <g stroke="var(--scene-accent)" strokeWidth="1.5" opacity="0.34" className="anim-rain">
          <line x1="160" y1="90" x2="148" y2="122" />
          <line x1="280" y1="160" x2="268" y2="192" />
          <line x1="490" y1="70" x2="478" y2="102" />
          <line x1="690" y1="130" x2="678" y2="162" />
          <line x1="840" y1="80" x2="828" y2="112" />
          <line x1="1040" y1="150" x2="1028" y2="182" />
        </g>
      )}

      {/* Scene 1 Carriage Arched Pillars Framing Triptych */}
      {sceneIndex === 1 && (
        <path
          d="M0,0 L1200,0 L1200,540 L0,540 Z M48,72 C48,50 64,38 86,38 L344,38 C366,38 382,50 382,72 L382,366 C382,386 366,398 344,398 L86,398 C64,398 48,386 48,366 Z M418,72 C418,50 434,38 456,38 L744,38 C766,38 782,50 782,72 L782,366 C782,386 766,398 744,398 L456,398 C434,398 418,386 418,366 Z M818,72 C818,50 834,38 856,38 L1114,38 C1136,38 1152,50 1152,72 L1152,366 C1152,386 1136,398 1114,398 L856,398 C834,398 818,386 818,366 Z"
          fill="var(--scene-struct)"
          fillRule="evenodd"
        />
      )}

      {/* Scene 1 Foreground Brass Luggage Rack */}
      {sceneIndex === 1 && (
        <g>
          <line x1="56" y1="98" x2="368" y2="98" stroke="var(--pop)" strokeWidth="3" />
          <rect x="115" y="54" width="128" height="42" rx="6" fill="var(--surface)" stroke="var(--pop2)" strokeWidth="2" />
          <path d="M162,54 L162,44 L196,44 L196,54" fill="none" stroke="var(--pop2)" strokeWidth="2" />
          <polygon points="315,98 250,360 380,360" fill={`url(#cone-${sceneIndex})`} />
          <circle cx="315" cy="98" r="6" fill="var(--scene-glow)" />
        </g>
      )}

      {/* Tonal Echo Veil */}
      {echo !== 'neutral' && <rect x="0" y="0" width="1200" height="540" fill={echoTint} />}

      {/* Inactive Gaze Pane Dimming Masks + Active Spotlight Frame */}
      <rect
        x="48"
        y="38"
        width="334"
        height="360"
        rx="22"
        fill="var(--bg)"
        opacity={gaze === 'left' ? 0 : 0.36}
      />
      <rect
        x="418"
        y="38"
        width="364"
        height="360"
        rx="22"
        fill="var(--bg)"
        opacity={gaze === 'center' ? 0 : 0.36}
      />
      <rect
        x="818"
        y="38"
        width="334"
        height="360"
        rx="22"
        fill="var(--bg)"
        opacity={gaze === 'right' ? 0 : 0.36}
      />
      <rect
        x={activePane.x}
        y="38"
        width={activePane.w}
        height="360"
        rx="24"
        fill="none"
        stroke="var(--pop2)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
