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
    '--user-data-dir=/tmp/chrome-test-profile-v2',
    'http://localhost:8081'
  ]);

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

    // Force viewport to 1440x900 desktop mode
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Wait 3.5s for Expo web to bundle
    await new Promise(r => setTimeout(r, 3500));

    // Dismiss onboarding if present
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.innerText && el.innerText.includes('Tagesausgabe öffnen'));
          if (btn) {
            const target = btn.closest('[role="button"]') || btn;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 2000));

    // 1. Capture contained feed view
    const res1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/10-desktop-contained-feed.png', Buffer.from(res1.data, 'base64'));
    console.log('1. Captured 10-desktop-contained-feed.png');

    // 2. Click YouTube Space pill
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const pill = all.find(el => el.innerText && el.innerText.trim() === 'c/youtube');
          if (pill) {
            const target = pill.closest('[role="button"]') || pill;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1200));

    const res2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/11-desktop-youtube-live.png', Buffer.from(res2.data, 'base64'));
    console.log('2. Captured 11-desktop-youtube-live.png');

    // 3. Click Books Space pill
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const pill = all.find(el => el.innerText && el.innerText.trim() === 'c/books');
          if (pill) {
            const target = pill.closest('[role="button"]') || pill;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1200));

    const res3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/12-desktop-books-live.png', Buffer.from(res3.data, 'base64'));
    console.log('3. Captured 12-desktop-books-live.png');

    // 4. Click Memes Space pill
    await send('Runtime.evaluate', {
      expression: `
        (() => {
          const all = Array.from(document.querySelectorAll('*'));
          const pill = all.find(el => el.innerText && el.innerText.trim() === 'c/memes');
          if (pill) {
            const target = pill.closest('[role="button"]') || pill;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          }
        })()
      `
    });

    await new Promise(r => setTimeout(r, 1200));

    const res4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/Users/studio/.gemini/antigravity/brain/559b3454-134e-4b8a-957f-b1e49846fe9f/13-desktop-xkcd-memes.png', Buffer.from(res4.data, 'base64'));
    console.log('4. Captured 13-desktop-xkcd-memes.png');

    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
