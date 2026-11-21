import type { ThemeMeta } from '../hooks/useTheme';
import type { SceneRecord, SignalSource } from '../types/signals';

interface ExportPalette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  pop: string;
  pop2: string;
  popSoft: string;
  sceneStruct: string;
}

const THEME_PALETTE: Record<ThemeMeta['id'], ExportPalette> = {
  monograph: {
    bg: '#FAF9F6',
    surface: '#FFFFFF',
    ink: '#111111',
    muted: '#52525B',
    line: '#E2DFD7',
    pop: '#1D4ED8',
    pop2: '#E03E2D',
    popSoft: '#DBEAFE',
    sceneStruct: '#1E293B',
  },
  obsidian: {
    bg: '#09090B',
    surface: '#121216',
    ink: '#FAFAFA',
    muted: '#A1A1AA',
    line: '#27272A',
    pop: '#FF5A36',
    pop2: '#2CE5A7',
    popSoft: '#3B1810',
    sceneStruct: '#1E1B2E',
  },
  botanical: {
    bg: '#F4F7F5',
    surface: '#FFFFFF',
    ink: '#0C231C',
    muted: '#466158',
    line: '#D2DFD8',
    pop: '#059669',
    pop2: '#F97316',
    popSoft: '#D1FAE5',
    sceneStruct: '#133A2E',
  },
};

function drawScenePlate(
  ctx: CanvasRenderingContext2D,
  sceneIdx: number,
  px: number,
  py: number,
  pw: number,
  ph: number,
  pal: ExportPalette
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  const sx = (nx: number) => px + (nx / 200) * pw;
  const sy = (ny: number) => py + (ny / 130) * ph;

  ctx.fillStyle = pal.bg;
  ctx.fillRect(px, py, pw, ph);

  if (sceneIdx === 0) {
    // I. Morning Steam
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2;
    for (const ly of [22, 36, 50]) {
      ctx.beginPath();
      ctx.moveTo(sx(20), sy(ly));
      ctx.lineTo(sx(180), sy(ly));
      ctx.stroke();
    }
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(sx(74), sy(76));
    ctx.lineTo(sx(126), sy(76));
    ctx.lineTo(sx(120), sy(114));
    ctx.quadraticCurveTo(sx(100), sy(119), sx(80), sy(114));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx(124), sy(84));
    ctx.bezierCurveTo(sx(138), sy(84), sx(138), sy(104), sx(122), sy(104));
    ctx.stroke();

    ctx.strokeStyle = pal.pop2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(90), sy(66));
    ctx.bezierCurveTo(sx(82), sy(52), sx(98), sy(42), sx(90), sy(28));
    ctx.stroke();

    ctx.strokeStyle = pal.pop;
    ctx.beginPath();
    ctx.moveTo(sx(110), sy(66));
    ctx.bezierCurveTo(sx(102), sy(52), sx(118), sy(40), sx(110), sy(24));
    ctx.stroke();
  } else if (sceneIdx === 1) {
    // II. The Last Train North
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(sx(24), sy(18), sx(176) - sx(24), sy(112) - sy(18), 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = pal.bg;
    ctx.strokeStyle = pal.pop;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(100), sy(60), (22 / 200) * pw, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = pal.ink;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(100), sy(60));
    ctx.lineTo(sx(96), sy(47));
    ctx.stroke();

    ctx.strokeStyle = pal.pop2;
    ctx.beginPath();
    ctx.moveTo(sx(100), sy(60));
    ctx.lineTo(sx(112), sy(68));
    ctx.stroke();

    ctx.strokeStyle = pal.line;
    ctx.beginPath();
    ctx.moveTo(sx(34), sy(96));
    ctx.lineTo(sx(166), sy(96));
    ctx.stroke();
  } else if (sceneIdx === 2) {
    // III. The Empty Desk
    ctx.fillStyle = pal.popSoft;
    ctx.beginPath();
    ctx.moveTo(sx(78), sy(42));
    ctx.lineTo(sx(36), sy(112));
    ctx.lineTo(sx(128), sy(112));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(148), sy(112));
    ctx.lineTo(sx(126), sy(38));
    ctx.lineTo(sx(78), sy(42));
    ctx.stroke();

    ctx.fillStyle = pal.pop2;
    ctx.beginPath();
    ctx.arc(sx(78), sy(42), (8 / 200) * pw, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.6;
    ctx.fillRect(sx(44), sy(102), sx(110) - sx(44), sy(112) - sy(102));
    ctx.strokeRect(sx(44), sy(102), sx(110) - sx(44), sy(112) - sy(102));
  } else if (sceneIdx === 3) {
    // IV. Two Chairs
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(sx(100), sy(0));
    ctx.lineTo(sx(100), sy(30));
    ctx.stroke();

    ctx.fillStyle = pal.pop;
    ctx.beginPath();
    ctx.arc(sx(100), sy(36), (9 / 200) * pw, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(46), sy(66));
    ctx.lineTo(sx(46), sy(110));
    ctx.moveTo(sx(46), sy(88));
    ctx.lineTo(sx(76), sy(88));
    ctx.lineTo(sx(76), sy(110));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sx(154), sy(66));
    ctx.lineTo(sx(154), sy(110));
    ctx.moveTo(sx(154), sy(88));
    ctx.lineTo(sx(124), sy(88));
    ctx.lineTo(sx(124), sy(110));
    ctx.stroke();
  } else {
    // V. Open Doorway
    ctx.fillStyle = pal.sceneStruct;
    ctx.fillRect(px, py, pw, ph);

    ctx.fillStyle = pal.popSoft;
    ctx.beginPath();
    ctx.moveTo(sx(74), sy(20));
    ctx.lineTo(sx(120), sy(20));
    ctx.lineTo(sx(170), sy(130));
    ctx.lineTo(sx(50), sy(130));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.8;
    ctx.fillRect(sx(74), sy(20), sx(120) - sx(74), sy(104) - sy(20));
    ctx.strokeRect(sx(74), sy(20), sx(120) - sx(74), sy(104) - sy(20));

    ctx.fillStyle = pal.pop;
    ctx.beginPath();
    ctx.moveTo(sx(74), sy(20));
    ctx.lineTo(sx(100), sy(28));
    ctx.lineTo(sx(100), sy(112));
    ctx.lineTo(sx(74), sy(104));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function loadLogoImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 1500);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = '/afterimage-logo.png';
  });
}

export async function exportContactSheetPng(
  records: SceneRecord[],
  themeId: ThemeMeta['id'],
  source: SignalSource
) {
  const pal = THEME_PALETTE[themeId];
  const logoImg = await loadLogoImage();
  const width = 1600;
  const height = 920;
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

  if (logoImg) {
    const boxX = width - 178;
    const boxY = 44;
    const boxW = 114;
    const boxH = 78;
    if (themeId === 'obsidian') {
      ctx.fillStyle = '#FAF9F6';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 12);
      ctx.fill();
    }
    const scale = Math.min((boxW - 12) / logoImg.width, (boxH - 10) / logoImg.height);
    const drawW = logoImg.width * scale;
    const drawH = logoImg.height * scale;
    const drawX = boxX + (boxW - drawW) / 2;
    const drawY = boxY + (boxH - drawH) / 2;
    ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
  }

  const visited = records.filter((r) => r.holdSeconds > 0);
  const totalSec = records.reduce((s, r) => s + r.holdSeconds, 0);
  const totalBlinks = records.reduce((s, r) => s + r.blinkCuts, 0);
  const avgBreath =
    visited.length > 0
      ? Math.round(visited.reduce((s, r) => s + r.avgBreathSteadiness, 0) / visited.length)
      : 0;
  const pulseRecs = visited.filter((r) => typeof r.avgPulseBpm === 'number');
  const pulseTag =
    pulseRecs.length > 0
      ? `  ·  AVG PULSE ${(pulseRecs.reduce((s, r) => s + (r.avgPulseBpm || 0), 0) / pulseRecs.length).toFixed(1)} BPM (§7.4)`
      : '';

  ctx.fillStyle = pal.muted;
  ctx.font = '15px Consolas, monospace';
  ctx.fillText(
    `SITTING ${totalSec.toFixed(1)}s  ·  ${totalBlinks} BLINK CUTS  ·  ${avgBreath}% BREATH CLARITY${pulseTag}  ·  SOURCE: ${source.toUpperCase()}  ·  ZERO RAW VIDEO`,
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
  const cardH = 626;

  records.forEach((rec, idx) => {
    const x = startX + idx * (cardW + gap);
    const unvisited = rec.holdSeconds === 0;
    ctx.fillStyle = pal.surface;
    ctx.fillRect(x, cardY, cardW, cardH);
    ctx.strokeStyle = pal.line;
    ctx.strokeRect(x, cardY, cardW, cardH);

    // Real 5-scene illustration inside top plate window
    const plateX = x + 18;
    const plateY = cardY + 18;
    const plateW = cardW - 36;
    const plateH = 175;
    drawScenePlate(ctx, rec.sceneIndex, plateX, plateY, plateW, plateH, pal);
    ctx.strokeStyle = pal.line;
    ctx.strokeRect(plateX, plateY, plateW, plateH);

    // Plate Roman numeral & title
    ctx.fillStyle = pal.muted;
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`PLATE ${rec.roman}  ·  ${rec.holdSeconds.toFixed(1)}s`, x + 18, cardY + 224);

    ctx.fillStyle = pal.ink;
    ctx.font = '22px Georgia, serif';
    ctx.fillText(rec.title, x + 18, cardY + 258);

    ctx.fillStyle = pal.muted;
    ctx.font = '13px "Segoe UI", sans-serif';
    if (unvisited) {
      ctx.fillText('Not visited in this sitting', x + 18, cardY + 292);
    } else {
      ctx.fillText(`${rec.blinkCuts} blink cuts · Echo: ${rec.dominantEcho}`, x + 18, cardY + 292);
      ctx.fillText(`${rec.unlockedHiddenCount}/3 hidden notes developed`, x + 18, cardY + 314);
      if (typeof rec.avgPulseBpm === 'number') {
        ctx.fillStyle = pal.pop;
        ctx.fillText(`Pulse (opt-in §7.4): ${rec.avgPulseBpm.toFixed(1)} bpm`, x + 18, cardY + 336);
      }
    }

    // Blink cut ticks
    ctx.fillStyle = pal.pop;
    const ticks = Math.min(12, rec.blinkCuts);
    for (let t = 0; t < ticks; t += 1) {
      ctx.fillRect(x + 18 + t * 14, cardY + 360, 8, 12);
    }

    // Honest Chest breath trace waveform (flat dashed line if unvisited / no trace)
    const waveW = cardW - 36;
    const waveMidY = cardY + 452;
    if (!unvisited && rec.breathRibbon.length > 1) {
      ctx.strokeStyle = pal.pop2;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      rec.breathRibbon.forEach((v, wi) => {
        const px = x + 18 + (wi / Math.max(1, rec.breathRibbon.length - 1)) * waveW;
        const py = waveMidY - v * 34;
        if (wi === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    } else {
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x + 18, waveMidY);
      ctx.lineTo(x + 18 + waveW, waveMidY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gaze L / C / R bar
    const gSum = rec.gazeCounts.left + rec.gazeCounts.center + rec.gazeCounts.right;
    const barY = cardY + 544;
    if (!unvisited && gSum > 0) {
      const lW = (rec.gazeCounts.left / gSum) * waveW;
      const cW = (rec.gazeCounts.center / gSum) * waveW;
      const rW = (rec.gazeCounts.right / gSum) * waveW;
      ctx.fillStyle = pal.muted;
      ctx.fillRect(x + 18, barY, lW, 8);
      ctx.fillStyle = pal.pop;
      ctx.fillRect(x + 18 + lW, barY, cW, 8);
      ctx.fillStyle = pal.pop2;
      ctx.fillRect(x + 18 + lW + cW, barY, rW, 8);
    } else {
      ctx.fillStyle = pal.line;
      ctx.fillRect(x + 18, barY, waveW, 8);
    }

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
