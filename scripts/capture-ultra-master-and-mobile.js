const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f';

async function main() {
  console.log('Launching headless Chrome to capture visual proofs...');
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/chrome-test-master-studio',
    'http://localhost:8081'
  ]);

  await new Promise(r => setTimeout(r, 2500));

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
  await new Promise(r => setTimeout(r, 3000));

  // 1. Capture Ultra Master Studio
  console.log('Opening Ultra Master Studio modal...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(el => el.innerText && (el.innerText.includes('Master Studio') || el.innerText.includes('⚡ Master Studio')));
      if (btn) {
        const target = btn.closest('[role="button"]') || btn;
        target.click();
        return 'CLICKED_MASTER';
      }
      return 'NO_MASTER_BTN';
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 1500));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '30-atmen-ultra-master-studio.png'), Buffer.from(shot1.result.data, 'base64'));
  console.log('✓ Saved 30-atmen-ultra-master-studio.png');

  // Close Ultra Master Studio modal
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const closeBtn = all.find(el => el.getAttribute('aria-label') === 'Schließen' || (el.innerText && el.innerText === '✕'));
      if (closeBtn) closeBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // 2. Open Mobile Publish QR modal
  console.log('Opening Mobile QR Publish modal...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(el => el.innerText && el.innerText.includes('Aufs Handy'));
      if (btn) {
        const target = btn.closest('[role="button"]') || btn;
        target.click();
        return 'CLICKED_MOBILE';
      }
      return 'NO_MOBILE_BTN';
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 1500));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '31-atmen-mobile-qr-modal.png'), Buffer.from(shot2.result.data, 'base64'));
  console.log('✓ Saved 31-atmen-mobile-qr-modal.png');

  // Close Mobile QR modal
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const closeBtn = all.find(el => el.getAttribute('aria-label') === 'Schließen' || (el.innerText && el.innerText === '✕'));
      if (closeBtn) closeBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // 3. Open News-Hub Modal and select Raindrop tab
  console.log('Opening News-Hub and switching to Raindrop tab...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const hubBtn = all.find(el => el.innerText && el.innerText.includes('News-Hub'));
      if (hubBtn) {
        const target = hubBtn.closest('[role="button"]') || hubBtn;
        target.click();
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const raindropTab = all.find(el => el.innerText && el.innerText.includes('Raindrop.io'));
      if (raindropTab) {
        const target = raindropTab.closest('[role="button"]') || raindropTab;
        target.click();
        return 'CLICKED_RAINDROP';
      }
      return 'NO_RAINDROP_TAB';
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '32-atmen-raindrop-tab.png'), Buffer.from(shot3.result.data, 'base64'));
  console.log('✓ Saved 32-atmen-raindrop-tab.png');

  ws.close();
  chrome.kill();
  console.log('Visual proof capture complete!');
}

main().catch(err => {
  console.error('Error during capture:', err);
  process.exit(1);
});
