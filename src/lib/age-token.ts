import { createHmac } from 'crypto';

const TYPE = 'age-rsvp';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function createAgeToken(email: string): string {
  const secret = import.meta.env.CONVENTION_SECRET;
  const payload = Buffer.from(JSON.stringify({
    type: TYPE,
    email,
    exp: Date.now() + EXPIRY_MS,
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAgeToken(token: string): { email: string } | null {
  try {
    const secret = import.meta.env.CONVENTION_SECRET;
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    if (expected !== sig) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.type !== TYPE) return null;
    if (Date.now() > data.exp) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}
