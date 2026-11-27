/**
 * Theme Service
 *
 * Persists custom colour themes using tauri-plugin-store and applies the
 * selected one to <html> as CSS variable overrides. "JP3" is the locked
 * built-in theme: selecting it removes the overrides so :root in global.css wins.
 *
 * Storage format:
 * {
 *   selectedId: 'jp3' | string,
 *   custom: [{ id, name, colors: { '--sketch-bg', '--secondary', '--tertiary', '--sketch-text' } }]
 * }
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'settings.json';
const THEMES_KEY = 'themes';

export const JP3_ID = 'jp3';

// Mirrors :root in global.css (text and borders share one colour in custom themes)
export const JP3_COLORS = {
  '--sketch-bg': '#f5f5f1',
  '--secondary': '#9785c9',
  '--tertiary': '#548478',
  '--sketch-text': '#242424',
};

// Text colours for accent backgrounds, and the brightness (0 = black, 1 = white)
// above which a background counts as light and gets dark text
const DARK_TEXT = '#242424';
const LIGHT_TEXT = '#fff';
const LIGHT_BACKGROUND_THRESHOLD = 0.5;

// Perceived brightness: green looks brightest to the eye, blue darkest (ITU-R BT.601 weights)
export function readableTextOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  return brightness > LIGHT_BACKGROUND_THRESHOLD ? DARK_TEXT : LIGHT_TEXT;
}

const DEFAULT_SETTINGS = { selectedId: JP3_ID, custom: [] };
const OVERRIDDEN_VARS = [...Object.keys(JP3_COLORS), '--sketch-border', '--on-secondary', '--on-tertiary'];

let storeInstance = null;

async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_NAME, { autoSave: true });
  }
  return storeInstance;
}

export const getSelectedTheme = ({ selectedId, custom }) =>
  custom.find((theme) => theme.id === selectedId) || null;

export async function loadThemes() {
  try {
    const store = await getStore();
    const saved = await store.get(THEMES_KEY);
    if (!saved || !Array.isArray(saved.custom)) return DEFAULT_SETTINGS;
    const custom = saved.custom.filter((theme) => theme?.id && theme.colors);
    const settings = { selectedId: saved.selectedId, custom };
    return getSelectedTheme(settings) ? settings : { ...settings, selectedId: JP3_ID };
  } catch (error) {
    console.error('Failed to load themes:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveThemes(settings) {
  try {
    const store = await getStore();
    await store.set(THEMES_KEY, settings);
  } catch (error) {
    console.error('Failed to save themes:', error);
  }
}

export function applyTheme(settings) {
  const root = document.documentElement;
  const theme = getSelectedTheme(settings);
  if (!theme) {
    OVERRIDDEN_VARS.forEach((name) => root.style.removeProperty(name));
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = 'custom';
  Object.entries(theme.colors).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty('--sketch-border', theme.colors['--sketch-text']);
  root.style.setProperty('--on-secondary', readableTextOn(theme.colors['--secondary']));
  root.style.setProperty('--on-tertiary', readableTextOn(theme.colors['--tertiary']));
}
