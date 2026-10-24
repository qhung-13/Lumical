/**
 * Shared configuration for the I03-P03 reproduction scripts.
 *
 * Nothing here belongs to one machine any more. Every value is either an
 * environment variable or discovered from the usual system locations, so the
 * scripts run on a colleague's laptop without editing them. See README.md for
 * copy-paste commands.
 *
 *   SPIKE_ORIGIN  URL of the running spike server   (default http://127.0.0.1:8787)
 *   SPIKE_TOKEN_A / SPIKE_TOKEN_B                   (default the dev tokens)
 *   CHROME_PATH    path to Chrome/Chromium          (default: auto-detected)
 *   FIREFOX_PATH   path to Firefox                  (default: puppeteer's own build)
 *   P03_TARGETS    directory holding version-a.png / version-b.png / unknown.png
 *   P03_SCRATCH    writable directory for fake-camera videos and browser profiles
 */
import { tmpdir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── spike server ───────────────────────────────────────────────────────────
export const ORIGIN = process.env.SPIKE_ORIGIN ?? 'http://127.0.0.1:8787';
export const TOKEN_A = process.env.SPIKE_TOKEN_A ?? 'devtokenA123456789';
export const TOKEN_B = process.env.SPIKE_TOKEN_B ?? 'devtokenB123456789';

// ── browsers ───────────────────────────────────────────────────────────────
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

/** Chromium build used by every Chrome script. Throws instead of silently failing. */
export function chrome() {
  const found = CHROME_CANDIDATES.find(existsSync);
  if (!found) {
    throw new Error(
      'No Chrome/Chromium found. Point CHROME_PATH at one and retry.\n' +
      'Tried:\n  ' + CHROME_CANDIDATES.join('\n  '),
    );
  }
  return found;
}

/**
 * Firefox build, or undefined so puppeteer uses the one it manages itself
 * (`npx @puppeteer/browsers install firefox@stable`). Only the p03-firefox*.mjs
 * scripts need it; the rest never touch this.
 */
export const firefox = () => process.env.FIREFOX_PATH || undefined;

// ── scratch space ──────────────────────────────────────────────────────────
/** Writable directory for generated Y4M videos and throwaway browser profiles. */
export const SCRATCH = process.env.P03_SCRATCH ?? join(tmpdir(), 'i03-p03');
mkdirSync(SCRATCH, { recursive: true });

/** Path inside the scratch directory, e.g. `scratch('target-a.y4m')`. */
export const scratch = (name) => join(SCRATCH, name);

// ── spike target images ────────────────────────────────────────────────────
/**
 * Path to a committed spike target image. They are build inputs rather than
 * repository files, so the directory must be supplied.
 */
export function target(name) {
  const dir = process.env.P03_TARGETS;
  if (!dir) {
    throw new Error(
      'Set P03_TARGETS to the directory holding version-a.png / version-b.png / unknown.png',
    );
  }
  return join(dir, name);
}
