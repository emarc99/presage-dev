import { Link, NavLink } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/calibrate', label: 'Calibrate', end: false },
  { to: '/experience', label: 'Experience', end: false },
  { to: '/contact-sheet', label: 'Contact Sheet', end: false },
];

export function Navbar() {
  const { theme, setTheme, themes, signals } = useSession();

  const sourceLabel =
    signals.source === 'bridge'
      ? signals.bridgeStatus.state === 'running'
        ? 'Bridge Live'
        : 'Bridge'
      : signals.source === 'sample'
      ? 'Sample Trace'
      : 'Preview';

  const sourceDotColor =
    signals.source === 'bridge' && signals.bridgeStatus.state === 'running'
      ? 'var(--pop2)'
      : 'var(--pop)';

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Left Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--ink)" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="4.2" fill="var(--pop)" />
            <circle cx="12" cy="12" r="1.4" fill="var(--bg)" />
          </svg>
          <span
            className="font-serif-ed text-lg font-semibold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            AFTERIMAGE
          </span>
        </Link>

        {/* Center Multi-Page Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="px-3.5 py-1.5 rounded-full text-sm transition-colors no-underline"
              style={({ isActive }) => ({
                background: isActive ? 'var(--pop-soft)' : 'transparent',
                color: isActive ? 'var(--pop)' : 'var(--ink-muted)',
                fontWeight: isActive ? 600 : 500,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Top-Right Theme Switcher + Status Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="inline-flex items-center rounded-full p-1 gap-0.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            role="group"
            aria-label="Theme Switcher"
          >
            {themes.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  title={t.label}
                  aria-pressed={active}
                  className="px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                  style={{
                    background: active ? 'var(--pop)' : 'transparent',
                    color: active ? 'var(--pop-contrast)' : 'var(--ink-muted)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: active ? 'var(--pop-contrast)' : t.popHex,
                    }}
                  />
                  <span className="hidden sm:inline">{t.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <span
            className="hidden lg:inline-flex items-center gap-1.5 font-mono-tab text-xs px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              color: 'var(--ink-muted)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: sourceDotColor }}
            />
            {sourceLabel}
          </span>
        </div>
      </div>

      {/* Mobile Nav Strip */}
      <nav
        className="md:hidden px-4 pb-2.5 flex items-center justify-center gap-1 overflow-x-auto"
        aria-label="Mobile"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="px-3 py-1 rounded-full text-xs no-underline whitespace-nowrap"
            style={({ isActive }) => ({
              background: isActive ? 'var(--pop-soft)' : 'transparent',
              color: isActive ? 'var(--pop)' : 'var(--ink-muted)',
              fontWeight: isActive ? 600 : 500,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
