import puppeteer from 'puppeteer-core';
import fs from 'fs';
const CSS = `*::-webkit-scrollbar{width:6px;height:6px;background:transparent}*::-webkit-scrollbar-thumb{background:#3a3a3a;border-radius:6px}*::-webkit-scrollbar-track{background:transparent}*{scrollbar-width:thin;scrollbar-color:#3a3a3a transparent}`;
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--window-size=1920,1080', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const boxes = {};
const box = (sel) => p.$$eval(sel, (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, t: (e.innerText || '').trim().split('\n')[0].slice(0, 40) }; }));
await p.goto('http://127.0.0.1:4330/#computer', { waitUntil: 'domcontentloaded' });
await p.addStyleTag({ content: CSS }); await wait(8000);
await p.screenshot({ path: '../cap/computer.png' });
boxes.apps = await box('#desktop .app'); boxes.orgs = await box('#orgs .org'); boxes.screen = await box('#screen');
await p.evaluate(() => { location.hash = '#globe'; }); await wait(5000);
await p.screenshot({ path: '../cap/globe.png' }); boxes.globe = await box('#globe');
const ids = ['facebook', 'tiktok', 'instagram', 'youtube', 'snapchat', 'discord', 'whatsapp', 'chrome', 'spotify', 'zoom'];
boxes.dossier = {};
for (const id of ids) {
  await p.evaluate((h) => { location.hash = h; }, '#dossier/' + id); await wait(900);
  await p.screenshot({ path: `../cap/dossier-${id}.png` });
  boxes.dossier[id] = await p.evaluate((id) => {
    const els = [...document.querySelectorAll('#view-dossier a, #view-dossier button, #view-dossier li')];
    const sel = els.find((e) => e.classList.contains('active') || e.getAttribute('aria-current') || e.getAttribute('aria-selected') === 'true');
    const r = sel ? sel.getBoundingClientRect() : null;
    return r ? { x: r.x, y: r.y, w: r.width, h: r.height, t: sel.innerText.trim().slice(0, 30) } : null;
  }, id);
}
fs.writeFileSync('../cap/boxes.json', JSON.stringify(boxes, null, 1));
await b.close(); console.log('ok', boxes.apps.length, boxes.orgs.length, JSON.stringify(boxes.dossier));
