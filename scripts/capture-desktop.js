const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chrome = spawn(chromePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--window-size=1440,1024',
    '--user-data-dir=/tmp/chrome-test-profile',
    'http://localhost:8081'
  ]);

  // Wait for Chrome CDP port to become ready
  let list;
  for (let i = 0; i < 20; i++) {
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
    } catch (e) {
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

    // Wait 3s for page to load
    await new Promise(r => setTimeout(r, 3000));

    // Check if onboarding button exists, click it with full mouse events
    const clickOnboarding = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.innerText && el.innerText.includes('Tagesausgabe öffnen'));
          if (btn) {
            const target = btn.closest('[role="button"]') || btn;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return 'clicked onboarding';
          }
          return 'feed already loaded';
        })()
      `,
      returnByValue: true
    });
    console.log('Onboarding step:', clickOnboarding.result?.value);

    // Wait 2.5s for feed to settle
    await new Promise(r => setTimeout(r, 2500));

    // 1. Capture main feed view
    const res1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/desktop-reddit-feed.png', Buffer.from(res1.data, 'base64'));
    console.log('Successfully captured desktop-reddit-feed.png');

    // 2. Click Palette switcher button
    const clickPalette = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.getAttribute('aria-label') === 'Design-Ästhetik & Farbpalette wählen');
          if (btn) {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return 'clicked palette button';
          }
          return 'palette button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('Palette step:', clickPalette.result?.value);

    await new Promise(r => setTimeout(r, 1000));

    // Capture palette modal
    const res2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/desktop-palette-modal.png', Buffer.from(res2.data, 'base64'));
    console.log('Successfully captured desktop-palette-modal.png');

    // Close palette modal by clicking "Fertig" or close button
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.innerText && el.innerText.trim() === 'Fertig' || el.innerText && el.innerText.trim() === '✕');
          if (btn) {
            const target = btn.closest('[role="button"]') || btn;
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 800));

    // 3. Click AI Budget & Sparring pill
    const clickAI = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.getAttribute('aria-label') === 'KI-Orchestrierung & Budget öffnen');
          if (btn) {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return 'clicked AI modal button';
          }
          return 'AI button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('AI step:', clickAI.result?.value);

    await new Promise(r => setTimeout(r, 1000));

    // Capture AI modal
    const res3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/desktop-ai-modal.png', Buffer.from(res3.data, 'base64'));
    console.log('Successfully captured desktop-ai-modal.png');

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
