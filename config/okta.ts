const OKTA_DOMAIN = import.meta.env.VITE_OKTA_DOMAIN;
const CLIENT_ID = import.meta.env.VITE_OKTA_CLIENT_ID;
const EXTENSION_ID = chrome.runtime.id;
const REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/`;

const AUTH_URL =
  `https://${OKTA_DOMAIN}/oauth2/default/v1/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `response_type=token&` +
  `scope=openid profile email&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `nonce=random_nonce_value&state=random_state_value`;

export function loginWithOkta() {
  console.log({ AUTH_URL, REDIRECT_URI });
  chrome.identity.launchWebAuthFlow(
    {
      url: AUTH_URL,
      interactive: true,
    },
    (redirectUrl) => {
      console.log({ redirectUrl });
      if (chrome.runtime.lastError) {
        console.error('Login failed:', chrome.runtime.lastError.message);
        return;
      }

      if (redirectUrl) {
        const params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
        const accessToken = params.get('access_token');
        const idToken = params.get('id_token');

        if (accessToken) {
          console.log('✅ Logged in successfully:', { accessToken, idToken });
        }
      }
    }
  );
}
