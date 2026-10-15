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
    '--remote-debugging-port=9227',
    '--disable-gpu',
    '--window-size=1440,960',
    '--user-data-dir=/tmp/chrome-test-empty-pocket-5',
    'http://localhost:8081'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const list = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:9227/json', r => {
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
  await new Promise(r => setTimeout(r, 1000));

  // Seed onboarded user profile
  console.log('Seeding valid onboarded user profile in localStorage...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const validProfile = {
        language: 'de',
        region: 'de',
        explicitInterests: {
          philosophy_ethics: 0.90,
          german_didactics: 0.85,
          ai_apple: 0.80,
          contemplation_mind: 0.75,
          science_society: 0.70,
          sound_synthesis: 0.60,
          memes_satire: 0.75,
          youtube_gems: 0.85,
          book_mastery: 0.90,
          health_biohacking: 0.85,
          opportunities_growth: 0.80
        },
        explicitGoals: {
          understand_tech: 0.95,
          creative_music: 0.85,
          deepen_attention: 0.80,
          philosophical_clarity: 0.95,
          society_and_ethics: 0.75
        },
        editorialTargets: {
          teachingTargetRatio: 0.10,
          challengingTargetRatio: 0.10
        },
        feedbackMemory: {
          boostedTopics: {},
          penalizedTopics: {},
          boostedAuthors: {},
          penalizedAuthors: {},
          boostedKeywords: {},
          penalizedKeywords: {}
        },
        behavioralSignals: {
          recentOpenedIds: [],
          recentSavedIds: [],
          completedReadIds: []
        },
        readingPreferences: {
          preferredDuration: 'balanced',
          theme: 'dark',
          palette: 'tidalglass',
          fontSize: 'md'
        },
        isOnboarded: true,
        lastActiveDate: '2026-10-15'
      };
      localStorage.setItem('@atem:user_profile:v1', JSON.stringify(validProfile));
    })()`
  });

  console.log('Reloading page with onboarded state...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 3000));

  // 1. Capture Desktop Home with Home Pill & Logo
  console.log('Capturing Home screen...');
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '33-atmen-home-center.png'), Buffer.from(shot1.result.data, 'base64'));
  console.log('✓ Saved 33-atmen-home-center.png');

  // 2. Trigger an Empty Pocket using nativeInputValueSetter
  console.log('Setting input value using nativeInputValueSetter...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Kybernetik_Deep');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return 'SET_INPUT';
      }
      return 'NO_INPUT';
    })()`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 1500));

  // Capture Empty Pocket Generator Card
  console.log('Capturing Empty Pocket Generator card...');
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '34-atmen-empty-pocket-generator.png'), Buffer.from(shot2.result.data, 'base64'));
  console.log('✓ Saved 34-atmen-empty-pocket-generator.png');

  // 3. Click "⚡ Stream on-the-fly generieren"
  console.log('Clicking Stream on-the-fly generieren...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(el => el.innerText && (el.innerText.includes('on-the-fly generieren') || el.innerText.includes('Stream on-the-fly')));
      if (btn) {
        const target = btn.closest('[role="button"]') || btn;
        target.click();
        return 'CLICKED_GENERATE';
      }
      return 'NO_GEN_BTN';
    })()`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 2000));

  // Clear search query to show all items
  await send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return 'CLEARED';
      }
      return 'NO_INPUT';
    })()`,
    returnByValue: true
  });
  await new Promise(r => setTimeout(r, 1500));

  // Capture populated stream
  console.log('Capturing newly generated stream in feed...');
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ARTIFACT_DIR, '35-atmen-populated-stream.png'), Buffer.from(shot3.result.data, 'base64'));
  console.log('✓ Saved 35-atmen-populated-stream.png');

  console.log('All screenshots captured successfully.');
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
