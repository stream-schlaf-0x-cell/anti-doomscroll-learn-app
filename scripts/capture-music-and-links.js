const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

async function capture() {
  const artifactDir = '/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f';

  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,1024',
    '--user-data-dir=/tmp/chrome-test-music-links-3',
    'http://localhost:8081'
  ]);
  await new Promise(r => setTimeout(r, 2000));

  const list = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222/json', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = list.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let id = 1;
  const send = (m, p = {}) => new Promise((resolve) => {
    const msgId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === msgId) { ws.off('message', handler); resolve(msg); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
  });

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 960, deviceScaleFactor: 1, mobile: false });
  await new Promise(r => setTimeout(r, 3500));

  // If in Reader or Settings, return to Feed
  await send('Runtime.evaluate', {
    expression: `(() => {
      const back = document.querySelector('[aria-label="Zurück zur Übersicht"]') || document.querySelector('[aria-label="Zurück zum Feed"]');
      if (back) back.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Scroll down slightly to show the Rich Link Preview Card
  await send('Runtime.evaluate', {
    expression: `window.scrollBy(0, 320)`
  });
  await new Promise(r => setTimeout(r, 800));

  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artifactDir}/25-atmen-prominent-links-feed.png`, Buffer.from(ss1.result.data, 'base64'));
  console.log('✓ Captured 25-atmen-prominent-links-feed.png');

  // Open News-Hub Modal
  const hubRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const hubBtn = document.querySelector('[aria-label="News-Hub & Quellen-Zentrale öffnen"]');
      if (hubBtn) {
        hubBtn.click();
        return 'CLICKED NEWS HUB';
      }
      return 'NO NEWS HUB';
    })()`,
    returnByValue: true
  });
  console.log('Hub Click:', hubRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 1200));

  // Click "Musik & Audio" tab in News-Hub
  const musicTabRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const tab = all.find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Musik & Audio');
      if (tab) {
        const target = tab.closest('[role="button"]') || tab;
        target.click();
        return 'CLICKED MUSIC TAB';
      }
      return 'NO MUSIC TAB';
    })()`,
    returnByValue: true
  });
  console.log('Music Tab Click:', musicTabRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  const ss3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artifactDir}/27-atmen-newshub-music-itunes.png`, Buffer.from(ss3.result.data, 'base64'));
  console.log('✓ Captured 27-atmen-newshub-music-itunes.png');

  // Close News-Hub
  await send('Runtime.evaluate', {
    expression: `(() => {
      const close = document.querySelector('[aria-label="News-Hub schließen"]');
      if (close) close.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click "c/synth_alchemie" chip to show sound synthesis music cards
  const klangRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const klang = all.find(el => el.innerText && el.innerText.includes('c/synth_alchemie'));
      if (klang) {
        const target = klang.closest('[role="button"]') || klang;
        target.click();
        return 'CLICKED C/SYNTH_ALCHEMIE';
      }
      return 'NO C/SYNTH_ALCHEMIE';
    })()`,
    returnByValue: true
  });
  console.log('Synth Alchemie Click:', klangRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  // Scroll to show the music card
  await send('Runtime.evaluate', {
    expression: `window.scrollBy(0, 300)`
  });
  await new Promise(r => setTimeout(r, 800));

  const ss4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${artifactDir}/28-atmen-sound-synthesis-music-card.png`, Buffer.from(ss4.result.data, 'base64'));
  console.log('✓ Captured 28-atmen-sound-synthesis-music-card.png');

  ws.close();
  chrome.kill();
}

capture().catch(console.error);
