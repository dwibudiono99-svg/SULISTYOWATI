import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account consent',
});

let isSigningIn = false;
// Access token MUST live strictly in JS memory — never localStorage or sessionStorage.
let cachedAccessToken: string | null = null;

export function initGmailAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
}

export async function googleGmailSignIn(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Token akses Gmail tidak diperoleh dari Google Sign-In. Silakan coba lagi.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedGmailToken(): void {
  cachedAccessToken = null;
}

export async function gmailSignOut(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export interface EmailAttachmentPayload {
  filename: string;
  mimeType: string;
  base64Content: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return uint8ToBase64(bytes);
}

export function bytesToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return uint8ToBase64(bytes);
}

function wrapBase64(b64: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += lineLength) {
    lines.push(b64.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

function toBase64UrlFromUtf8(text: string): string {
  return textToBase64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeRfc2047Utf8Header(text: string): string {
  const hasNonAscii = /[^\x20-\x7E]/.test(text);
  if (!hasNonAscii) return text;
  return `=?UTF-8?B?${textToBase64(text)}?=`;
}

export async function sendBackupEmailViaGmail(params: {
  accessToken: string;
  toEmail: string;
  ccEmail?: string;
  subject: string;
  bodyText: string;
  attachments: EmailAttachmentPayload[];
}): Promise<{ id: string; threadId?: string }> {
  const boundary = `----=_Part_SIPTU_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const headers: string[] = [
    `To: ${params.toEmail.trim()}`,
    ...(params.ccEmail?.trim() ? [`Cc: ${params.ccEmail.trim()}`] : []),
    `Subject: ${encodeRfc2047Utf8Header(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(textToBase64(params.bodyText)),
  ];

  for (const att of params.attachments) {
    const safeFilename = att.filename.replace(/["\r\n]/g, '_');
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${safeFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeFilename}"`,
      '',
      wrapBase64(att.base64Content)
    );
  }

  parts.push(`--${boundary}--`, '');

  const rawMime = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
  const rawEncoded = toBase64UrlFromUtf8(rawMime);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawEncoded }),
  });

  if (response.status === 401 || response.status === 403) {
    clearCachedGmailToken();
    const errPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      errPayload?.error?.message ||
        'Sesi izin Gmail berakhir atau belum diberi akses kirim email. Silakan klik Sign in with Google kembali.'
    );
  }

  if (!response.ok) {
    const errPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(errPayload?.error?.message || `Gagal mengirim email melalui Gmail (HTTP ${response.status}).`);
  }

  return (await response.json()) as { id: string; threadId?: string };
}
