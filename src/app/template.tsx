/**
 * Re-mounts on every navigation, giving each page a short fade + rise (CSS only, ~300ms).
 * Pure CSS on purpose: content is visible immediately, with no dependence on hydration.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
