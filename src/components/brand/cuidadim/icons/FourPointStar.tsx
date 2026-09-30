/**
 * Four-point star — Cozy Celestial motif (cuidadim-icons-v2 / Figma).
 * Intentional accents only — never spray on every nav item.
 */
export function FourPointStar({
  size = 12,
  color = "#CCA863",
  className = "",
  title,
}: {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <path d="M12 1.5c.35 2.85.95 5.2 2.35 7.15C15.85 10.75 18.2 11.6 21.5 12c-3.3.4-5.65 1.25-7.15 3.35C12.95 17.3 12.35 19.65 12 22.5c-.35-2.85-.95-5.2-2.35-7.15C8.15 13.25 5.8 12.4 2.5 12c3.3-.4 5.65-1.25 7.15-3.35C11.05 6.7 11.65 4.35 12 1.5Z" />
    </svg>
  );
}
