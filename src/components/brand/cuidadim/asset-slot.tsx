import type { AssetStatus } from "@/components/brand/cuidadim/logo-assets";

const STATUS_LABEL: Record<AssetStatus, string> = {
  APPROVED: "APPROVED",
  "APPROVED ASSET": "APPROVED ASSET",
  "APPROVED PICTOGRAM": "APPROVED PICTOGRAM",
  "ALTERNATE ASSET": "ALTERNATE ASSET",
  CANDIDATE: "CANDIDATE",
  MISSING: "MISSING",
  DEFERRED: "DEFERRED — NO FINAL ASSET PROVIDED",
  LEGACY: "LEGACY",
  AMBIGUOUS: "AMBÍGUO",
};

type AssetSlotProps = {
  label: string;
  path: string;
  status: AssetStatus;
  note?: string;
  frameClassName?: string;
  invertSurface?: boolean;
  mediaSrc?: string | null;
  objectFit?: "contain" | "cover";
  children?: React.ReactNode;
};

/**
 * Structured slot for brand assets with QA status.
 * Never invents artwork — MISSING/DEFERRED show placeholder; others show media as-is.
 */
export function AssetSlot({
  label,
  path,
  status,
  note,
  frameClassName = "min-h-[7.5rem]",
  invertSurface = false,
  mediaSrc,
  objectFit = "contain",
  children,
}: AssetSlotProps) {
  const showMedia =
    status !== "MISSING" &&
    status !== "DEFERRED" &&
    (Boolean(mediaSrc) || Boolean(children));
  const surfaceStyle = invertSurface
    ? { background: "var(--cuidadim-purple)", color: "var(--cuidadim-creme)" }
    : undefined;
  const approvedLike =
    status === "APPROVED" ||
    status === "APPROVED ASSET" ||
    status === "APPROVED PICTOGRAM" ||
    status === "ALTERNATE ASSET";

  return (
    <figure className="cd-swatch flex min-w-0 flex-col">
      <div className={`relative grid place-items-center px-3 py-4 ${frameClassName}`} style={surfaceStyle}>
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: approvedLike
              ? "color-mix(in srgb, var(--cuidadim-gold) 28%, var(--surface))"
              : status === "CANDIDATE"
                ? "color-mix(in srgb, var(--cuidadim-rosa) 32%, var(--surface))"
                : "var(--surface-muted)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {STATUS_LABEL[status]}
        </span>
        {showMedia ? (
          children ? (
            children
          ) : mediaSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- brand QA needs raw SVG/PNG
            <img
              src={mediaSrc}
              alt={label}
              className="max-h-full max-w-full"
              style={{ objectFit, width: "100%", height: "auto", maxHeight: "9rem" }}
            />
          ) : null
        ) : (
          <div className="cd-placeholder w-full max-w-[16rem]">
            <span className="block font-bold">{label}</span>
            <span className="mt-1 block break-all opacity-80">{path}</span>
            <span className="mt-2 block text-[0.65rem] uppercase tracking-[0.12em] opacity-70">
              {status === "DEFERRED" ? "Deferred · no final asset" : "Asset ausente"}
            </span>
          </div>
        )}
      </div>
      <figcaption className="border-t border-[var(--border)] px-3 py-2">
        <p className="text-xs font-bold text-[var(--text-primary)]">{label}</p>
        <p className="mt-0.5 break-all text-[10px] text-[var(--text-secondary)]">{path}</p>
        {note ? <p className="mt-1 text-[10px] leading-snug text-[var(--text-secondary)]">{note}</p> : null}
      </figcaption>
    </figure>
  );
}
