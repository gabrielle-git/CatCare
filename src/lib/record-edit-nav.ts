/**
 * Routes where App Router soft-navigation is unreliable and we force
 * full document navigation for leaving / navigating away.
 *
 * Future: hook unsaved-changes confirm here before allowing leave.
 */
export function isRecordEditPath(pathname: string): boolean {
  return /^\/records\/[^/]+\/edit$/.test(pathname);
}
