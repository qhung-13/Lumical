// Synthetic reveal content. Image + meaningful message is a sufficient P0 reveal (BR-AR-001).
const PALETTE = { A: { bg: '#0f766e', word: 'Teal' }, B: { bg: '#b45309', word: 'Amber' } };

export function buildContent(versionKey) {
  const p = PALETTE[versionKey];
  if (!p) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="${p.bg}"/><text x="200" y="150" font-size="120" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${versionKey}</text></svg>`;
  return {
    versionLabel: versionKey,
    title: `Synthetic version ${versionKey}`,
    message: `Synthetic message for version ${versionKey}. If you can read this, the ${p.word.toLowerCase()} version ${versionKey} was revealed inside its own authorized scope.`,
    image: {
      alt: `Synthetic ${p.word.toLowerCase()} card with the letter ${versionKey}`,
      dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    },
  };
}
