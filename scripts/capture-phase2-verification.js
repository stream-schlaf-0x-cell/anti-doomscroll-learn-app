const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f';

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,1024',
    '--user-data-dir=/tmp/chrome-test-profile-v5',
    'http://localhost:8081'
  ]);

  let list;
  for (let i = 0; i < 25; i++) {
    try {
      list = await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json', res => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy(new Error('timeout')));
      });
      if (list && list.length > 0) break;
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  try {
    const page = list.find(p => p.type === 'page');
    if (!page) throw new Error('No page found');

    const WebSocket = require('ws');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const msgId = id++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === msgId) {
          ws.off('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await new Promise(r => ws.on('open', r));

    // Force viewport to 1440x960 desktop
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false
    });

    const clickSelector = async (selector) => {
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('${selector}');
            if (!el) return false;
            el.click();
            return true;
          })()
        `,
        returnByValue: true
      });
      return evalRes.result?.result?.value;
    };

    const clickInnermostText = async (textSnippet) => {
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (() => {
            const all = Array.from(document.querySelectorAll('*'));
            const matching = all.filter(e => e.children.length === 0 && e.innerText && e.innerText.includes(${JSON.stringify(textSnippet)}));
            if (matching.length === 0) return false;
            const target = matching[0].closest('[role="button"]') || matching[0];
            target.click();
            return true;
          })()
        `,
        returnByValue: true
      });
      return evalRes.result?.result?.value;
    };

    // Wait for Expo web to load and bundle
    await new Promise(r => setTimeout(r, 4500));

    // If Reader is open, close it
    await clickSelector('[aria-label="Zurück zur Übersicht"]');
    await clickSelector('[aria-label="Zurück zur vorherigen Ansicht"]');
    await new Promise(r => setTimeout(r, 600));

    // If Settings is open, close it
    await clickSelector('[aria-label="Zurück zum Feed"]');
    await clickSelector('[aria-label="Einstellungen schließen"]');
    await new Promise(r => setTimeout(r, 1200));

    // 1. Capture atmen Desktop Feed
    const res1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${ARTIFACT_DIR}/20-atmen-desktop-feed.png`, Buffer.from(res1.data, 'base64'));
    console.log('✓ 1. Captured 20-atmen-desktop-feed.png');

    // 2. Open News-Hub Modal
    const newsHubOpened = await clickSelector('[aria-label="News-Hub & Quellen-Zentrale öffnen"]')
      || await clickInnermostText('News-Hub (29)')
      || await clickInnermostText('News-Hub');
    console.log('News-Hub opened:', newsHubOpened);
    await new Promise(r => setTimeout(r, 1200));

    const res2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${ARTIFACT_DIR}/21-atmen-newshub-catalog.png`, Buffer.from(res2.data, 'base64'));
    console.log('✓ 2. Captured 21-atmen-newshub-catalog.png');

    // 3. Switch to Import & OPML tab in News-Hub Modal
    const importTabClicked = await clickInnermostText('Import & OPML');
    console.log('Import & OPML tab clicked:', importTabClicked);
    await new Promise(r => setTimeout(r, 1000));

    const res3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${ARTIFACT_DIR}/22-atmen-newshub-import.png`, Buffer.from(res3.data, 'base64'));
    console.log('✓ 3. Captured 22-atmen-newshub-import.png');

    // Close News-Hub modal
    await clickSelector('[aria-label="News-Hub schließen"]');
    await new Promise(r => setTimeout(r, 800));

    // 4. Open Settings screen
    await clickSelector('[aria-label="Einstellungen öffnen"]');
    await new Promise(r => setTimeout(r, 1200));

    const res4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${ARTIFACT_DIR}/23-atmen-settings-fixed.png`, Buffer.from(res4.data, 'base64'));
    console.log('✓ 4. Captured 23-atmen-settings-fixed.png');

    // 5. Navigate back to feed
    await clickSelector('[aria-label="Zurück zum Feed"]');
    await new Promise(r => setTimeout(r, 1000));

    // 6. Click first article to open Magazine Reader View
    await clickInnermostText('Artikel lesen');
    await new Promise(r => setTimeout(r, 1500));

    const res5 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${ARTIFACT_DIR}/24-atmen-magazine-reader.png`, Buffer.from(res5.data, 'base64'));
    console.log('✓ 5. Captured 24-atmen-magazine-reader.png');

    ws.close();
    chrome.kill();
    console.log('✓ All 5 verification screenshots successfully captured with exact selectors!');
  } catch (err) {
    console.error('Error in capture script:', err);
    chrome.kill();
  }
}

main().catch(console.error);
