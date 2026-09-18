import { Camera, Cat } from "lucide-react";
import Link from "next/link";

const sizeClasses = {
  sm: "size-11",
  md: "size-14",
  lg: "size-24 md:size-28",
  profile: "size-28 md:size-32",
} as const;

/**
 * Circular pet avatar — object-fit cover + center. Optional camera affordance for profile.
 */
export function PetAvatar({
  name,
  photoUrl,
  size = "md",
  editHref,
  editable = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof sizeClasses;
  /** When set with editable, shows camera control linking to edit. */
  editHref?: string;
  editable?: boolean;
}) {
  const sizeClass = sizeClasses[size];
  const showCamera = Boolean(editable && editHref);

  const avatar = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={name}
      className={`${sizeClass} shrink-0 rounded-full object-cover object-center`}
    />
  ) : (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-[var(--lavender-soft)] text-[var(--lavender-strong)]`}
      aria-hidden="true"
    >
      <Cat size={size === "sm" ? 18 : size === "md" ? 22 : 34} strokeWidth={2.2} />
    </span>
  );

  if (!showCamera) return avatar;

  return (
    <div className="relative shrink-0">
      {avatar}
      <Link
        href={editHref!}
        aria-label={photoUrl ? "Alterar foto de perfil" : "Adicionar foto"}
        title={photoUrl ? "Alterar foto de perfil" : "Adicionar foto"}
        className="focus-ring absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border border-white bg-[var(--graphite)] text-white shadow-md"
      >
        <Camera size={16} aria-hidden />
      </Link>
    </div>
  );
}
