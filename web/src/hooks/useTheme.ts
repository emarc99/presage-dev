import { useEffect, useState } from 'react';
import type { ThemeId } from '../types/signals';

export interface ThemeMeta {
  id: ThemeId;
  shortLabel: string;
  label: string;
  popHex: string;
  pop2Hex: string;
  bgHex: string;
  cssClass: string;
}

export const THEME_OPTIONS: ThemeMeta[] = [
  {
    id: 'monograph',
    shortLabel: 'Monograph',
    label: 'Gallery Monograph',
    popHex: '#1D4ED8',
    pop2Hex: '#E03E2D',
    bgHex: '#FAF9F6',
    cssClass: 'theme-monograph',
  },
  {
    id: 'obsidian',
    shortLabel: 'Solar Coral',
    label: 'Obsidian & Solar Coral',
    popHex: '#FF5A36',
    pop2Hex: '#2CE5A7',
    bgHex: '#09090B',
    cssClass: 'theme-obsidian',
  },
  {
    id: 'botanical',
    shortLabel: 'Botanical',
    label: 'Botanical Slate & Citrus',
    popHex: '#059669',
    pop2Hex: '#F97316',
    bgHex: '#F4F7F5',
    cssClass: 'theme-botanical',
  },
];

const STORAGE_KEY = 'afterimage.theme';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (saved === 'monograph' || saved === 'obsidian' || saved === 'botanical') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'monograph';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const activeMeta = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];
  return { theme, setTheme, activeMeta, themes: THEME_OPTIONS };
}
