export function googleAdminUserSecurityUrl(userId: string): string {
  return `https://admin.google.com/ac/users/${encodeURIComponent(userId)}/security`;
}
