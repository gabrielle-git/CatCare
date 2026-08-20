const DEWORMING_TITLE = "Vermífugo";

export function newRecordHref(petId: string, type: string, title?: string, returnTo?: string) {
  const params = new URLSearchParams({ pet: petId, type });
  if (title) params.set("record_title", title);
  if (returnTo) params.set("return_to", returnTo);
  return `/records/new?${params.toString()}`;
}

/** Pre-selects type(s) without locking — filters, neonatal quick actions, etc. */
export function preselectRecordHref(opts: {
  pet?: string;
  type?: string;
  types?: string[];
  returnTo?: string;
  neonatal?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts.pet) params.set("pet", opts.pet);
  const types = (opts.types ?? []).filter((type) => type && type !== "all").slice(0, 2);
  if (types.length > 1) {
    params.set("types", types.join(","));
  } else if (types.length === 1) {
    params.set("type", types[0]);
  } else if (opts.type && opts.type !== "all") {
    params.set("type", opts.type);
  }
  if (opts.returnTo) params.set("return_to", opts.returnTo);
  if (opts.neonatal) params.set("context", "neonatal");
  const query = params.toString();
  return query ? `/records/new?${query}` : "/records/new";
}

/** Type locked, title editable — generic register from preventive care or profile shortcuts. */
export function typedRecordHref(petId: string, type: string, returnTo?: string) {
  const params = new URLSearchParams({ pet: petId, type, lock_type: "1" });
  if (returnTo) params.set("return_to", returnTo);
  return `/records/new?${params.toString()}`;
}

/** Type and title locked — overdue/due alerts and specific scheduled doses. */
export function dewormingAlertHref(petId: string, returnTo?: string) {
  return newRecordHref(petId, "deworming", DEWORMING_TITLE, returnTo);
}

export function vaccineAlertHref(petId: string, vaccineName: string, doseLabel: string, returnTo?: string) {
  return newRecordHref(petId, "vaccine", `${vaccineName} — ${doseLabel}`, returnTo);
}

export { DEWORMING_TITLE };
