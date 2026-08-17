import { Cat } from "lucide-react";

export function PetAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-20 rounded-[26px]" : size === "sm" ? "size-11 rounded-2xl" : "size-14 rounded-[20px]";
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name} className={`${sizeClass} shrink-0 object-cover`} />
    );
  }
  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center bg-[var(--lavender-soft)] text-[var(--lavender-strong)]`} aria-hidden="true">
      <Cat size={size === "lg" ? 30 : size === "sm" ? 18 : 22} strokeWidth={2.2} />
    </span>
  );
}
