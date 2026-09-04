/** FormData field for weight on a specific pet (multi-pet create). */
export function weightKgFieldName(petId: string) {
  return `weight_kg__${petId}`;
}

/** Legacy single-pet / edit field name — keep for backward compatibility. */
export const WEIGHT_KG_LEGACY_FIELD = "weight_kg";

/**
 * Future per-pet fields can follow the same pattern:
 * - amount_ml__{petId}
 * - temperature_c__{petId}
 * - quality_{type}__{petId}
 */
