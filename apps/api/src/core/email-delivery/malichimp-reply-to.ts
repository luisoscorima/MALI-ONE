const REPLY_TOKEN_RE = /\+mc\.([a-z0-9]+)@/i;

/** Build Gmail-compatible plus-address Reply-To that still lands in the base mailbox. */
export function replyToWithSendToken(replyTo: string, sendId: string): string {
  const trimmed = replyTo.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;
  const local = trimmed.slice(0, at).split('+')[0] || trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const token = sendId.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!local || !domain || !token) return trimmed;
  return `${local}+mc.${token}@${domain}`;
}

export function extractSendIdFromReplyAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(REPLY_TOKEN_RE);
  return match?.[1] ? match[1].toLowerCase() : null;
}

export function baseMailboxFromReplyTo(replyTo: string | null | undefined): string | null {
  if (!replyTo) return null;
  const trimmed = replyTo.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at).split('+')[0];
  const domain = trimmed.slice(at + 1);
  if (!local || !domain) return null;
  return `${local}@${domain}`;
}
