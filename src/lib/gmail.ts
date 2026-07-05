declare const google: any;

const CLIENT_ID = (import.meta as any).env.VITE_CLIENT_ID;
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send'
].join(' ');

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export const getGmailAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (cachedToken && Date.now() < tokenExpiry) {
      resolve(cachedToken);
      return;
    }

    if (!CLIENT_ID) {
      reject(new Error('VITE_CLIENT_ID is not configured in environment variables.'));
      return;
    }

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      reject(new Error('Google Identity Services script has not loaded yet. Please refresh the page and try again.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            cachedToken = response.access_token;
            tokenExpiry = Date.now() + (response.expires_in * 1000) - 60000; // Buffer
            resolve(response.access_token);
          } else {
            reject(new Error('Failed to get Gmail access token: ' + (response.error || 'Unknown error')));
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      reject(error);
    }
  });
};

const base64url = (str: string) => {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const sendGmail = async (to: string, subject: string, body: string) => {
  const token = await getGmailAccessToken();
  
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const message = [
    'From: "KCFC Liturgical Scheduler" <me>',
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    'X-Priority: 1',
    'Priority: Urgent',
    'Importance: High',
    'X-Auto-Response-Suppress: All',
    '',
    body
  ].join('\r\n');

  const raw = base64url(message);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to send email');
  }

  return response.json();
};
