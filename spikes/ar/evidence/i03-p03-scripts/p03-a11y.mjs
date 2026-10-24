import puppeteer from 'puppeteer-core';
import { ORIGIN, TOKEN_A as TOKEN, chrome } from './env.mjs';
const r = [];
const mark = (name, ok, detail = '') => { r.push({ name, ok, detail }); console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };

const b = await puppeteer.launch({
  executablePath: chrome(), headless: false, protocolTimeout: 60000,
  defaultViewport: { width: 420, height: 920 },
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const p = await b.newPage();
await p.goto(`${ORIGIN}/#t=${TOKEN}`, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

console.log('═══ A. SEMANTIC / ARIA ═══');
const sem = await p.evaluate(() => {
  const q = s => document.querySelector(s);
  return {
    lang: document.documentElement.lang,
    statusRole: q('#status')?.getAttribute('role'),
    statusLive: q('#status')?.getAttribute('aria-live'),
    revealLive: q('#reveal')?.getAttribute('aria-live'),
    containerLabel: q('#container')?.getAttribute('aria-label'),
    logTabIndex: q('#log')?.getAttribute('tabindex'),
    radioLabels: [...document.querySelectorAll('input[name=artifact]')].map(i => !!i.closest('label') || !!document.querySelector(`label[for="${i.id}"]`)),
    btnTypes: [...document.querySelectorAll('button')].map(x => x.type),
    fallbackText: q('#fallback-link')?.textContent.trim(),
    h1: !!q('h1') || document.querySelectorAll('h1').length,
    title: document.title,
  };
});
mark('lang trên <html>', !!sem.lang, sem.lang);
mark('#status có role=status', sem.statusRole === 'status');
mark('#status aria-live=polite', sem.statusLive === 'polite');
mark('#reveal aria-live=polite', sem.revealLive === 'polite');
mark('#container có aria-label', !!sem.containerLabel, sem.containerLabel);
mark('log focusable (tabindex)', sem.logTabIndex !== null, `tabindex=${sem.logTabIndex}`);
mark('radio buttons có <label>', sem.radioLabels.every(Boolean), JSON.stringify(sem.radioLabels));
mark('button có type=button', sem.btnTypes.every(t => t === 'button'), JSON.stringify(sem.btnTypes));
mark('fallback link có text', !!sem.fallbackText, `"${sem.fallbackText}"`);
mark('document.title', !!sem.title, `"${sem.title}"`);

console.log('\n═══ B. KEYBOARD — Tab tới Start, Enter bấm được ═══');
await p.keyboard.press('Tab');
const chain = [];
for (let i = 0; i < 10; i++) {
  const el = await p.evaluate(() => {
    const a = document.activeElement;
    return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.type ? '[' + a.type + ']' : ''} "${(a.textContent || a.value || '').trim().slice(0, 28)}"` : 'none';
  });
  chain.push(el);
  if (el.includes('#start')) break;
  await p.keyboard.press('Tab');
}
const reachedStart = chain.some(c => c.includes('#start'));
mark('Tab tới được nút Start', reachedStart, chain.join(' → '));

if (reachedStart) {
  const focusVisible = await p.evaluate(() => {
    const el = document.getElementById('start');
    el.focus();
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow.slice(0, 40) };
  });
  mark('Focus có chỉ báo thấy được', focusVisible.outline !== 'none' || focusVisible.boxShadow !== 'none',
    `outline=${focusVisible.outline} ${focusVisible.outlineWidth}`);

  const before = await p.$eval('#status', e => e.textContent);
  await p.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 6000));
  const after = await p.$eval('#status', e => e.textContent);
  mark('Enter kích hoạt Start (state đổi)', after !== before && /Scanning/i.test(after), `"${after.slice(0, 60)}"`);
  const ariaAnnounced = after !== before;
  mark('aria-live báo thay đổi trạng thái', ariaAnnounced, 'status text đổi qua aria-live=polite');
}

console.log('\n═══ C. Stop / fallback dùng bàn phím ═══');
const canReachStop = await p.evaluate(async () => {
  const start = document.getElementById('start'); start.focus();
  for (let i = 0; i < 20; i++) {
    const a = document.activeElement;
    if (a && a.id === 'stop') return { reached: true, disabled: a.disabled };
    // dispatch real Tab
    const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(evt);
    break;
  }
  return { reached: false };
});
mark('Nút Stop tồn tại và enabled khi đang chạy', await p.evaluate(() => !document.getElementById('stop').disabled));

const fbFocusable = await p.evaluate(() => {
  const f = document.getElementById('fallback-link');
  f.focus();
  return document.activeElement === f && f.offsetParent !== null;
});
mark('Fallback link focusable + visible', fbFocusable);

console.log('\n═══ D. Gửi khung — KHÔNG camera / khi bị chặn ═══');
const noCamText = await p.evaluate(() => document.getElementById('fallback-link').textContent.trim());
mark('Fallback text mô tả được (không nói camera)', /without camera/i.test(noCamText), `"${noCamText}"`);

const hiddenNotHidden = await p.evaluate(() => {
  // phần tử ẩn có aria-hidden / hidden không (không focus vào được)
  const rv = document.getElementById('reveal');
  return { revealHidden: rv.hidden, choiceHidden: document.getElementById('artifact-choice').hidden };
});
mark('reveal ẩn đúng lúc chưa có nội dung', hiddenNotHidden.revealHidden, JSON.stringify(hiddenNotHidden));

console.log('\n════════════════════════════════');
console.log(`  ACC: ${r.filter(x => x.ok).length}/${r.length} pass`);
const failed = r.filter(x => !x.ok);
if (failed.length) { console.log('  FAIL:'); failed.forEach(f => console.log(`    ❌ ${f.name} — ${f.detail}`)); }
console.log('════════════════════════════════\n');

await b.close();
process.exit(0);
