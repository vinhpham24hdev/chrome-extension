import { OktaUser } from '@/types/auth';

const OKTA_DOMAIN = import.meta.env.VITE_OKTA_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_OKTA_CLIENT_ID;
const EXTENSION_ID = chrome.runtime.id;
const REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/`;
const AUTH_BASE = `https://${OKTA_DOMAIN}/oauth2/default/v1`;

function decodeJwt(token: string): OktaUser {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}

export async function loginWithOkta(): Promise<OktaUser | null> {
  const nonce = crypto.randomUUID();
  const state = crypto.randomUUID();

  const authUrl =
    `${AUTH_BASE}/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&response_type=token id_token` +
    `&scope=openid profile email` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${state}` +
    `&nonce=${nonce}`;

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          console.error('Login failed:', chrome.runtime.lastError?.message);
          return reject(new Error('Login failed'));
        }

        const params = new URLSearchParams(
          new URL(redirectUrl).hash.substring(1)
        );
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (!idToken || !accessToken)
          return reject(new Error('Tokens missing'));

        const user = {
          ...decodeJwt(idToken),
          isOktaAuth: true,
        };

        chrome.storage.local.set(
          {
            idToken,
            accessToken,
            user,
          },
          () => {
            resolve(user);
          }
        );
      }
    );
  });
}

export async function logoutFromOkta(): Promise<void> {
  const { idToken } = await chrome.storage.local.get('idToken');
  if (!idToken) return;

  const logoutUrl =
    `${AUTH_BASE}/logout` +
    `?id_token_hint=${idToken}` +
    `&post_logout_redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  chrome.identity.launchWebAuthFlow(
    { url: logoutUrl, interactive: true },
    () => {
      chrome.storage.local.clear();
    }
  );
}

export async function getCurrentUser(): Promise<OktaUser | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('user', ({ user }) => {
      resolve(user ?? null);
    });
  });
}
