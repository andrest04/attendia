/** URL-safe base64 without padding (RFC 4648 §5), shared by cursors and download tickets. */
export function encodeBase64Url(input: string | Buffer): string {
  return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
