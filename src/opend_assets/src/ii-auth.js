/**
 * II Auth Bridge - runs in browser when opened from mobile app.
 * Shows a button so window.open is triggered by user gesture (avoids popup blocker).
 */
import { AuthClient } from '@dfinity/auth-client';

const APP_SCHEME = 'opend';

function showError(msg) {
  document.body.innerHTML = '<p style="color:red;font-family:sans-serif;padding:20px;">' + msg + '</p>';
}

function showButton(client, iiUrl) {
  document.body.innerHTML = `
    <div style="font-family:sans-serif;padding:40px 20px;text-align:center;">
      <p style="margin-bottom:24px;">Tap the button below to sign in with Internet Identity</p>
      <button id="ii-btn" style="padding:14px 28px;font-size:16px;background:#3b82f6;color:white;border:none;border-radius:8px;">
        Continue to Internet Identity
      </button>
    </div>
  `;
  document.getElementById('ii-btn').onclick = () => {
    client.login({
      identityProvider: iiUrl,
      onSuccess: () => {},
      onError: (err) => showError('Sign-in failed: ' + (err || 'unknown')),
      maxTimeToLive: BigInt(7 * 24 * 60 * 60) * BigInt(1000000000)
    });
  };
}

async function run() {
  const params = new URLSearchParams(window.location.search);
  const iiCanisterId = params.get('iiCanisterId') || 'uxrrr-q7777-77774-qaaaq-cai';
  const protocol = window.location.protocol || 'http:';
  const host = window.location.host || 'localhost:8000';
  const iiUrl = protocol + '//' + host + '/?canisterId=' + iiCanisterId + '#authorize';

  const store = {};
  const RedirectCaptureStorage = {
    get: async (k) => store[k] ?? null,
    set: async (k, v) => {
      store[k] = v;
      if (k === 'delegation' && store['identity']) {
        try {
          const data = JSON.stringify({ key: store['identity'], delegation: v });
          const encoded = btoa(unescape(encodeURIComponent(data)));
          window.location.replace(APP_SCHEME + '://auth#' + encoded);
        } catch (e) {
          console.error(e);
          showError('Failed to complete sign-in.');
        }
      }
    },
    remove: async (k) => { delete store[k]; }
  };

  try {
    const client = await AuthClient.create({
      storage: RedirectCaptureStorage,
      keyType: 'Ed25519',
      idleOptions: { disableIdle: true }
    });

    if (await client.isAuthenticated()) {
      const key = store['identity'];
      const delegation = store['delegation'];
      if (key && delegation) {
        const data = JSON.stringify({ key, delegation });
        const encoded = btoa(unescape(encodeURIComponent(data)));
        window.location.replace(APP_SCHEME + '://auth#' + encoded);
        return;
      }
    }

    showButton(client, iiUrl);
  } catch (e) {
    console.error(e);
    showError('Error: ' + (e.message || e));
  }
}

run();
