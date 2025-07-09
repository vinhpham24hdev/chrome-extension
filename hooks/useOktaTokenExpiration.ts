import { OktaUser } from '@/types/auth';
import { useEffect } from 'react';

function decodeJwt(token: string): OktaUser {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}

export function useOktaTokenExpiration(
  logoutCallback: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;

    let timeoutId: number;

    chrome.storage.local.get('idToken', ({ idToken }) => {
      if (!idToken) {
        logoutCallback();
        return;
      }

      try {
        const payload = decodeJwt(idToken);
        const now = Date.now();
        const exp = payload.exp * 1000;
        const timeUntilExpiry = exp - now;

        if (timeUntilExpiry <= 0) {
          console.log('[Auth]: token expired');
          logoutCallback();
        } else {
          timeoutId = window.setTimeout(() => {
            logoutCallback();
          }, timeUntilExpiry - 30_000);
        }
      } catch (err) {
        logoutCallback();
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [logoutCallback, enabled]);
}
