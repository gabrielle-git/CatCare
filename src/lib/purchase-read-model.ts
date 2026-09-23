import type { Product, ProductCategory, Purchase } from "@/types/database";

/**
 * Persisted purchase_items row (0037). Not economic truth on the header.
 */
export type PurchaseItemRow = {
  id: string;
  household_id: string;
  purchase_id: string;
  product_id: string | null;
  position: number;
  product_name: string;
  brand: string | null;
  category: ProductCategory;
  package_size: string | null;
  quantity: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  notes: string | null;
};

export type PurchaseReadLineSource = "item" | "legacy";

export type PurchaseReadLine = {
  /** Null for the virtual legacy line (never persisted). */
  id: string | null;
  product_id: string | null;
  product_name: string;
  brand: string | null;
  category: ProductCategory;
  package_size: string | null;
  quantity: number;
  /** Null when legacy merchandise is not exactly representable as integer unit price. */
  unit_price_cents: number | null;
  line_subtotal_cents: number;
  pet_ids: string[];
  effective_pet_ids: string[];
  position: number;
  source: PurchaseReadLineSource;
};

export type PurchaseReadSource = "items" | "legacy";

/**
 * Domain interpretation of a Purchase header + lines.
 * Physical DB row remains {@link Purchase}.
 */
export type PurchaseReadModel = Purchase & {
  source: PurchaseReadSource;
  lines: PurchaseReadLine[];
};

export type ProductLineSighting = {
  purchase: PurchaseReadModel;
  line: PurchaseReadLine;
};

/** Merchandise (pre-discount cart goods) for legacy header reconstruction. */
export function merchandiseCents(purchase: Pick<Purchase, "subtotal_cents" | "amount_cents" | "discount_cents">): number {
  if (purchase.subtotal_cents != null) return purchase.subtotal_cents;
  return purchase.amount_cents + (purchase.discount_cents || 0);
}

/**
 * Same deterministic approach as migration 0037 backfill:
 * candidate = round(merchandise / quantity); accept only if round(qty * unit) == merchandise.
 */
export function deriveLegacyUnitPriceCents(quantity: number, merchandise: number): number | null {
  if (!(quantity > 0) || !Number.isFinite(quantity) || !Number.isFinite(merchandise) || merchandise < 0) {
    return null;
  }
  const unit = Math.round(merchandise / quantity);
  if (!Number.isFinite(unit) || unit < 0) return null;
  const computed = Math.round(quantity * unit);
  if (computed !== merchandise) return null;
  return unit;
}

function sortPetIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

function effectivePetIds(explicitItemPets: string[], purchasePetIds: string[]): string[] {
  if (explicitItemPets.length >= 1) return sortPetIds(explicitItemPets);
  return sortPetIds(purchasePetIds);
}

function compareLines(a: PurchaseReadLine, b: PurchaseReadLine): number {
  if (a.position !== b.position) return a.position - b.position;
  return (a.id ?? "").localeCompare(b.id ?? "");
}

function legacyVirtualLine(
  purchase: Purchase,
  purchasePetIds: string[],
  productsById: Map<string, Product>,
): PurchaseReadLine {
  const product = productsById.get(purchase.product_id) ?? null;
  const merchandise = merchandiseCents(purchase);
  const unit = deriveLegacyUnitPriceCents(Number(purchase.quantity), merchandise);
  const pets = sortPetIds(purchasePetIds);
  return {
    id: null,
    product_id: purchase.product_id,
    product_name: product?.name ?? "Produto",
    brand: product?.brand ?? null,
    category: product?.category ?? "other",
    package_size: product?.package_size ?? null,
    quantity: Number(purchase.quantity),
    unit_price_cents: unit,
    line_subtotal_cents: merchandise,
    pet_ids: [],
    effective_pet_ids: pets,
    position: 0,
    source: "legacy",
  };
}

function itemToReadLine(
  item: PurchaseItemRow,
  itemPetIds: string[],
  purchasePetIds: string[],
): PurchaseReadLine {
  const explicit = sortPetIds(itemPetIds);
  return {
    id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    brand: item.brand,
    category: item.category,
    package_size: item.package_size,
    quantity: Number(item.quantity),
    unit_price_cents: item.unit_price_cents,
    line_subtotal_cents: item.line_subtotal_cents,
    pet_ids: explicit,
    effective_pet_ids: effectivePetIds(explicit, purchasePetIds),
    position: item.position,
    source: "item",
  };
}

/**
 * Build interpreted purchase truth from a header row + optional persisted items.
 * Does not write virtual legacy lines to the database.
 */
export function buildPurchaseReadModel(
  purchase: Purchase,
  items: PurchaseItemRow[],
  itemPetsByItemId: Map<string, string[]>,
  productsById: Map<string, Product>,
): PurchaseReadModel {
  const purchasePetIds = purchase.pet_ids ?? (purchase.pet_id ? [purchase.pet_id] : []);
  const purchaseItems = items.filter((item) => item.purchase_id === purchase.id);

  if (purchaseItems.length > 0) {
    const lines = purchaseItems
      .map((item) => itemToReadLine(item, itemPetsByItemId.get(item.id) ?? [], purchasePetIds))
      .sort(compareLines);
    return {
      ...purchase,
      pet_ids: sortPetIds(purchasePetIds),
      source: "items",
      lines,
    };
  }

  return {
    ...purchase,
    pet_ids: sortPetIds(purchasePetIds),
    source: "legacy",
    lines: [legacyVirtualLine(purchase, purchasePetIds, productsById)],
  };
}

export function buildPurchaseReadModels(
  purchases: Purchase[],
  items: PurchaseItemRow[],
  itemPetsByItemId: Map<string, string[]>,
  productsById: Map<string, Product>,
): PurchaseReadModel[] {
  const itemsByPurchase = new Map<string, PurchaseItemRow[]>();
  for (const item of items) {
    const list = itemsByPurchase.get(item.purchase_id) ?? [];
    list.push(item);
    itemsByPurchase.set(item.purchase_id, list);
  }
  return purchases.map((purchase) =>
    buildPurchaseReadModel(purchase, itemsByPurchase.get(purchase.id) ?? [], itemPetsByItemId, productsById),
  );
}

/** Purchases that contain the product on any interpreted line (persisted or legacy). */
export function purchasesContainingProduct(purchases: PurchaseReadModel[], productId: string): PurchaseReadModel[] {
  return purchases.filter((purchase) => purchase.lines.some((line) => line.product_id === productId));
}

export function latestSightingForProduct(
  purchases: PurchaseReadModel[],
  productId: string,
): ProductLineSighting | null {
  const sightings: ProductLineSighting[] = [];
  for (const purchase of purchases) {
    for (const line of purchase.lines) {
      if (line.product_id === productId) sightings.push({ purchase, line });
    }
  }
  if (sightings.length === 0) return null;
  sightings.sort((a, b) => new Date(b.purchase.purchased_at).getTime() - new Date(a.purchase.purchased_at).getTime());
  return sightings[0] ?? null;
}

/** Unit economics from a line — never cart amount / header quantity. */
export function lineUnitPriceCents(line: PurchaseReadLine): number | null {
  return line.unit_price_cents;
}

export function purchaseDisplayTitle(purchase: PurchaseReadModel): string {
  if (purchase.lines.length === 0) return "Compra";
  if (purchase.lines.length === 1) {
    const line = purchase.lines[0];
    return [line.brand, line.product_name].filter(Boolean).join(" • ") || line.product_name;
  }
  return `Compra · ${purchase.lines.length} itens`;
}

export function isMultiItemPurchase(purchase: PurchaseReadModel): boolean {
  return purchase.source === "items" && purchase.lines.length > 1;
}
