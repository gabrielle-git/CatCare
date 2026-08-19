const DEWORMING_TITLE = "Vermífugo";

export function newRecordHref(petId: string, type: string, title?: string) {
  const params = new URLSearchParams({ pet: petId, type });
  if (title) params.set("record_title", title);
  return `/records/new?${params.toString()}`;
}

/** Type locked, title editable — generic register from preventive care or profile shortcuts. */
export function typedRecordHref(petId: string, type: string) {
  return newRecordHref(petId, type);
}

/** Type and title locked — overdue/due alerts and specific scheduled doses. */
export function dewormingAlertHref(petId: string) {
  return newRecordHref(petId, "deworming", DEWORMING_TITLE);
}

export function vaccineAlertHref(petId: string, vaccineName: string, doseLabel: string) {
  return newRecordHref(petId, "vaccine", `${vaccineName} — ${doseLabel}`);
}

export { DEWORMING_TITLE };
