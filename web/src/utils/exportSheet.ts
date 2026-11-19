import type { ThemeMeta } from '../hooks/useTheme';
import type { SceneRecord, SignalSource } from '../types/signals';

const THEME_PALETTE: Record<
  ThemeMeta['id'],
  { bg: string; surface: string; ink: string; muted: string; line: string; pop: string; pop2: string }
> = {
  monograph: {
    bg: '#FAF9F6',
    surface: '#FFFFFF',
    ink: '#111111',
    muted: '#52525B',
    line: '#E2DFD7',
    pop: '#1D4ED8',
    pop2: '#E03E2D',
  },
  obsidian: {
    bg: '#09090B',
    surface: '#121216',
    ink: '#FAFAFA',
    muted: '#A1A1AA',
    line: '#27272A',
    pop: '#FF5A36',
    pop2: '#2CE5A7',
  },
  botanical: {
    bg: '#F4F7F5',
    surface: '#FFFFFF',
    ink: '#0C231C',
    muted: '#466158',
    line: '#D2DFD8',
    pop: '#059669',
    pop2: '#F97316',
  },
};

export function exportContactSheetPng(
  records: SceneRecord[],
  themeId: ThemeMeta['id'],
  source: SignalSource
) {
  const pal = THEME_PALETTE[themeId];
  const width = 1600;
  const height = 880;
  const cvs = document.createElement('canvas');
  cvs.width = width;
  cvs.height = height;
  const ctx = cvs.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = pal.ink;
  ctx.font = '38px Georgia, serif';
  ctx.fillText('AFTERIMAGE — Developed Contact Sheet', 64, 88);

  const totalSec = records.reduce((s, r) => s + r.holdSeconds, 0);
  const totalBlinks = records.reduce((s, r) => s + r.blinkCuts, 0);
  const avgBreath = Math.round(
    records.reduce((s, r) => s + r.avgBreathSteadiness, 0) / Math.max(1, records.length)
  );

  ctx.fillStyle = pal.muted;
  ctx.font = '15px Consolas, monospace';
  ctx.fillText(
    `SITTING ${totalSec.toFixed(1)}s  ·  ${totalBlinks} BLINK CUTS  ·  ${avgBreath}% BREATH CLARITY  ·  SOURCE: ${source.toUpperCase()}  ·  ZERO RAW VIDEO STORED`,
    64,
    124
  );

  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 152);
  ctx.lineTo(width - 64, 152);
  ctx.stroke();

  const cardW = 276;
  const gap = 22;
  const startX = 64;
  const cardY = 192;
  const cardH = 590;

  records.forEach((rec, idx) => {
    const x = startX + idx * (cardW + gap);
    ctx.fillStyle = pal.surface;
    ctx.fillRect(x, cardY, cardW, cardH);
    ctx.strokeStyle = pal.line;
    ctx.strokeRect(x, cardY, cardW, cardH);

    // Top plate graphic window
    ctx.fillStyle = pal.bg;
    ctx.fillRect(x + 18, cardY + 18, cardW - 36, 175);
    ctx.strokeStyle = pal.line;
    ctx.strokeRect(x + 18, cardY + 18, cardW - 36, 175);

    // Stylized focal motif inside plate
    ctx.strokeStyle = pal.pop;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + cardW / 2, cardY + 105, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = pal.pop2;
    ctx.beginPath();
    ctx.arc(x + cardW / 2 + idx * 4 - 8, cardY + 105, 8, 0, Math.PI * 2);
    ctx.fill();

    // Plate Roman numeral & title
    ctx.fillStyle = pal.muted;
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`PLATE ${rec.roman}  ·  ${rec.holdSeconds.toFixed(1)}s`, x + 18, cardY + 224);

    ctx.fillStyle = pal.ink;
    ctx.font = '22px Georgia, serif';
    ctx.fillText(rec.title, x + 18, cardY + 258);

    ctx.fillStyle = pal.muted;
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText(`${rec.blinkCuts} blink cuts · Echo: ${rec.dominantEcho}`, x + 18, cardY + 292);
    ctx.fillText(`${rec.unlockedHiddenCount} hidden notes developed`, x + 18, cardY + 314);

    // Blink cut ticks
    ctx.fillStyle = pal.pop;
    const ticks = Math.min(12, rec.blinkCuts);
    for (let t = 0; t < ticks; t += 1) {
      ctx.fillRect(x + 18 + t * 14, cardY + 342, 8, 12);
    }

    // Chest breath trace waveform
    const wave = rec.breathRibbon.length > 1 ? rec.breathRibbon : [0, 0.4, -0.3, 0.5, -0.4, 0.2, 0];
    ctx.strokeStyle = pal.pop2;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const waveW = cardW - 36;
    const waveMidY = cardY + 432;
    wave.forEach((v, wi) => {
      const px = x + 18 + (wi / Math.max(1, wave.length - 1)) * waveW;
      const py = waveMidY - v * 34;
      if (wi === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Gaze L / C / R bar
    const gTot = Math.max(1, rec.gazeCounts.left + rec.gazeCounts.center + rec.gazeCounts.right);
    const lW = (rec.gazeCounts.left / gTot) * waveW;
    const cW = (rec.gazeCounts.center / gTot) * waveW;
    const rW = (rec.gazeCounts.right / gTot) * waveW;
    const barY = cardY + 520;
    ctx.fillStyle = pal.muted;
    ctx.fillRect(x + 18, barY, lW, 8);
    ctx.fillStyle = pal.pop;
    ctx.fillRect(x + 18 + lW, barY, cW, 8);
    ctx.fillStyle = pal.pop2;
    ctx.fillRect(x + 18 + lW + cW, barY, rW, 8);

    ctx.fillStyle = pal.muted;
    ctx.font = '11px Consolas, monospace';
    ctx.fillText('GAZE L / C / R  &  CHEST TRACE', x + 18, barY + 26);
  });

  // Footer
  ctx.fillStyle = pal.muted;
  ctx.font = '12px Consolas, monospace';
  ctx.fillText('GENERATED ON-DEVICE WITH PRESAGE SMARTSPECTRA SDK SIGNALS · AFTERIMAGE', 64, height - 34);

  const link = document.createElement('a');
  link.href = cvs.toDataURL('image/png');
  link.download = 'afterimage-contact-sheet.png';
  link.click();
}
