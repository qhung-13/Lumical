// Camera-free path (BR-AR-004): loads no camera or AR code, shows the same authorized content.
const KEY = 'spike.token';
const hash = new URLSearchParams(location.hash.slice(1)).get('t');
if (hash) {
  sessionStorage.setItem(KEY, hash);
  history.replaceState(null, '', location.pathname);
}
const token = sessionStorage.getItem(KEY);
const status = document.getElementById('status');
const box = document.getElementById('reveal');

async function load() {
  if (!token) return (status.textContent = 'Content not available.');
  const res = await fetch('/api/spike/content', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return (status.textContent = 'Content not available.');
  const c = await res.json();
  box.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = c.title;
  const img = document.createElement('img');
  img.src = c.image.dataUri;
  img.alt = c.image.alt;
  const p = document.createElement('p');
  p.textContent = c.message;
  box.append(h, img, p);
  box.hidden = false;
  status.textContent = 'Showing the same content without the camera.';
}
load().catch(() => (status.textContent = 'Content not available.'));
