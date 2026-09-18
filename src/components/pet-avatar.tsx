"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Cat } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  removePetPhoto,
  replacePetProfilePhoto,
  setPetBuiltinAvatar,
} from "@/app/(app)/pets/actions";
import { ProfilePhotoCropDialog } from "@/components/profile-photo-crop-dialog";
import {
  BUILTIN_AVATAR_FILTERS,
  filterBuiltinPetAvatars,
  builtinPetAvatarPublicUrl,
  type BuiltinAvatarFilter,
  type BuiltinPetAvatarId,
} from "@/lib/pet-avatars";
import {
  compensatePetPhotoIfNeeded,
  runDirectPetPhotoUpload,
} from "@/lib/pet-photo-direct-upload-client";

const sizeClasses = {
  sm: "size-11",
  md: "size-14",
  lg: "size-24 md:size-28",
  profile: "size-28 md:size-32",
} as const;

function AvatarFace({
  name,
  photoUrl,
  size,
}: {
  name: string;
  photoUrl?: string | null;
  size: keyof typeof sizeClasses;
}) {
  const sizeClass = sizeClasses[size];
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [photoUrl]);

  const showImage = Boolean(photoUrl) && !broken;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl!}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover object-center`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-[var(--lavender-soft)] text-[var(--lavender-strong)]`}
      aria-hidden="true"
    >
      <Cat size={size === "sm" ? 18 : size === "md" ? 22 : 34} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Display-only circular pet avatar (lists, cards).
 */
export function PetAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof sizeClasses;
}) {
  return <AvatarFace name={name} photoUrl={photoUrl} size={size} />;
}

type MenuMode = "closed" | "menu" | "avatars" | "confirm-delete";

/**
 * Profile-page avatar with camera menu: choose photo, builtin avatar, delete.
 * Does not navigate to Edit Profile.
 */
export function PetProfilePhotoControl({
  petId,
  name,
  photoUrl,
  hasPhoto,
  editable,
}: {
  petId: string;
  name: string;
  photoUrl?: string | null;
  hasPhoto: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<MenuMode>("closed");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [pickedAvatar, setPickedAvatar] = useState<BuiltinPetAvatarId | null>(null);
  const [avatarFilter, setAvatarFilter] = useState<BuiltinAvatarFilter>("all");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function closeAll() {
    setMode("closed");
    setCropFile(null);
    setPickedAvatar(null);
    setAvatarFilter("all");
    setError(null);
    setStatus(null);
  }

  function openFilePicker() {
    setMode("closed");
    fileInputRef.current?.click();
  }

  function onFilePicked(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function runReplace(cropped: File) {
    setCropFile(null);
    startTransition(async () => {
      setError(null);
      setStatus("Enviando foto...");
      const formData = new FormData();
      const photoIntentId = crypto.randomUUID();
      let newlyCreatedPaths: string[] = [];
      try {
        newlyCreatedPaths = (
          await runDirectPetPhotoUpload(formData, petId, photoIntentId, cropped, (progress) => {
            setStatus(progress.message);
          })
        ).newlyCreatedPaths;
        setStatus("Salvando...");
        const result = await replacePetProfilePhoto(petId, formData);
        if (!result.ok) {
          if (newlyCreatedPaths.length) await compensatePetPhotoIfNeeded(newlyCreatedPaths);
          setError(result.error);
          setStatus(null);
          return;
        }
        closeAll();
        router.refresh();
      } catch (cause) {
        if (newlyCreatedPaths.length) await compensatePetPhotoIfNeeded(newlyCreatedPaths);
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar a foto.");
        setStatus(null);
      }
    });
  }

  function runDelete() {
    startTransition(async () => {
      setError(null);
      setStatus("Excluindo foto...");
      const result = await removePetPhoto(petId);
      setStatus(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeAll();
      router.refresh();
    });
  }

  function runSetAvatar(id: BuiltinPetAvatarId) {
    startTransition(async () => {
      setError(null);
      setStatus("Salvando avatar...");
      const result = await setPetBuiltinAvatar(petId, id);
      setStatus(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeAll();
      router.refresh();
    });
  }

  return (
    <div className="relative shrink-0">
      <AvatarFace name={name} photoUrl={photoUrl} size="profile" />

      {editable ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMode("menu");
          }}
          aria-label={hasPhoto ? "Alterar foto de perfil" : "Adicionar foto"}
          title={hasPhoto ? "Alterar foto de perfil" : "Adicionar foto"}
          className="focus-ring absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border border-white bg-[var(--graphite)] text-white shadow-md disabled:opacity-55"
        >
          <Camera size={16} aria-hidden />
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => onFilePicked(event.target.files)}
      />

      {mode === "menu" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-photo-menu-title"
            className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-xl"
          >
            <h2 id="pet-photo-menu-title" className="text-lg font-bold">
              Foto de perfil
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={openFilePicker}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left text-sm font-bold"
              >
                Escolher foto
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPickedAvatar(null);
                  setMode("avatars");
                }}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left text-sm font-bold"
              >
                Selecionar avatar
              </button>
              {hasPhoto ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setMode("confirm-delete")}
                  className="focus-ring rounded-2xl border border-red-200 bg-white px-4 py-3 text-left text-sm font-bold text-[var(--danger)]"
                >
                  Excluir foto
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={closeAll}
                className="focus-ring rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-bold"
              >
                Cancelar
              </button>
            </div>
            {error ? (
              <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "avatars" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-avatar-picker-title"
            className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col rounded-[24px] bg-white p-5 shadow-xl"
          >
            <h2 id="pet-avatar-picker-title" className="text-lg font-bold">
              Selecionar avatar
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Ilustrações originais CatCare.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {BUILTIN_AVATAR_FILTERS.map((filter) => {
                const active = avatarFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    disabled={pending}
                    onClick={() => setAvatarFilter(filter.id)}
                    aria-pressed={active}
                    className={`focus-ring rounded-full px-3 py-1.5 text-xs font-bold ${
                      active ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filterBuiltinPetAvatars(avatarFilter).map((avatar) => {
                  const selected = pickedAvatar === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      disabled={pending}
                      onClick={() => setPickedAvatar(avatar.id)}
                      aria-pressed={selected}
                      aria-label={avatar.label}
                      className={`focus-ring rounded-2xl border p-2 ${
                        selected ? "border-[var(--lavender)] bg-[var(--lavender-soft)]" : "border-[var(--border)] bg-white"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={builtinPetAvatarPublicUrl(avatar.id)}
                        alt=""
                        className="mx-auto size-16 rounded-full object-cover object-center"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <span className="mt-1 block text-center text-[10px] font-bold leading-tight">{avatar.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode("menu")}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={pending || !pickedAvatar}
                onClick={() => pickedAvatar && runSetAvatar(pickedAvatar)}
                className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-55"
              >
                Usar avatar
              </button>
            </div>
            {status || error ? (
              <p className={`mt-3 text-sm font-semibold ${error ? "text-[var(--danger)]" : "text-[var(--lavender-strong)]"}`} role={error ? "alert" : "status"}>
                {error ?? status}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "confirm-delete" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-photo-delete-title"
            className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl"
          >
            <h2 id="pet-photo-delete-title" className="text-lg font-bold">
              Excluir foto de perfil?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Você poderá adicionar outra foto depois.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setMode("menu")}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={runDelete}
                className="focus-ring rounded-2xl bg-[var(--danger)] px-4 py-2.5 text-sm font-bold text-white"
              >
                Excluir foto
              </button>
            </div>
            {status || error ? (
              <p className={`mt-3 text-sm font-semibold ${error ? "text-[var(--danger)]" : "text-[var(--lavender-strong)]"}`} role={error ? "alert" : "status"}>
                {error ?? status}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <ProfilePhotoCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        pending={pending}
        onCancel={() => setCropFile(null)}
        onConfirm={runReplace}
      />

      {status && mode === "closed" && !cropFile ? (
        <p className="absolute left-1/2 top-full mt-2 w-40 -translate-x-1/2 text-center text-[10px] font-bold text-[var(--lavender-strong)]">
          {status}
        </p>
      ) : null}
      {error && mode === "closed" && !cropFile ? (
        <p className="absolute left-1/2 top-full mt-2 w-48 -translate-x-1/2 text-center text-[10px] font-bold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
