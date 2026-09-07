import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
  FAMILY_HISTORY_FETCH_LIMIT,
  HOME_ACTIVITY_PREVIEW_LIMIT,
  familyHistoryHref,
  filterFamilyHistoryItems,
  resolveFamilyHistoryFilters,
} from "./family-history";
import { resolveReturnTo, safeReturnPath } from "./record-form";
import type { TimelineItem } from "@/types/database";

function item(
  partial: Partial<TimelineItem> & Pick<TimelineItem, "id" | "pet_id" | "kind" | "occurred_at">,
): TimelineItem {
  return {
    source: partial.source ?? "neonatal",
    title: partial.title ?? partial.kind,
    detail: partial.detail ?? null,
    tone: partial.tone ?? "peach",
    ...partial,
  };
}

const PET_A = "pet-a";
const PET_B = "pet-b";

const SAMPLE: TimelineItem[] = [
  item({ id: "1", pet_id: PET_A, kind: "feeding", occurred_at: "2026-09-07T08:00:00-03:00", source: "neonatal" }),
  item({ id: "2", pet_id: PET_B, kind: "weight", occurred_at: "2026-09-06T10:00:00-03:00", source: "weight" }),
  item({ id: "3", pet_id: PET_A, kind: "vaccine", occurred_at: "2026-08-20T15:00:00-03:00", source: "health" }),
  item({ id: "4", pet_id: PET_B, kind: "feeding", occurred_at: "2026-09-01T07:00:00-03:00", source: "neonatal" }),
  item({ id: "5", pet_id: PET_A, kind: "observation", occurred_at: "2026-07-01T12:00:00-03:00", source: "neonatal" }),
];

function readSrc(relative: string) {
  return readFileSync(join(process.cwd(), "src", relative), "utf8");
}

describe("family history helpers", () => {
  it("I. keeps records from multiple pets when unfiltered", () => {
    const filters = resolveFamilyHistoryFilters({});
    const result = filterFamilyHistoryItems(SAMPLE, filters);
    assert.equal(result.length, 5);
    assert.ok(result.some((row) => row.pet_id === PET_A));
    assert.ok(result.some((row) => row.pet_id === PET_B));
  });

  it("J. filters by pet", () => {
    const filters = resolveFamilyHistoryFilters({ pet: PET_B, knownPetIds: [PET_A, PET_B] });
    const result = filterFamilyHistoryItems(SAMPLE, filters);
    assert.deepEqual(
      result.map((row) => row.id),
      ["2", "4"],
    );
  });

  it("K. filters by from/to civil dates", () => {
    const filters = resolveFamilyHistoryFilters({ from: "2026-09-01", to: "2026-09-07" });
    const result = filterFamilyHistoryItems(SAMPLE, filters);
    assert.deepEqual(
      result.map((row) => row.id).sort(),
      ["1", "2", "4"],
    );
  });

  it("L. filters by type", () => {
    const filters = resolveFamilyHistoryFilters({ type: "feeding" });
    const result = filterFamilyHistoryItems(SAMPLE, filters);
    assert.ok(result.every((row) => row.kind === "feeding"));
    assert.equal(result.length, 2);
  });

  it("M. combines pet + date + type", () => {
    const filters = resolveFamilyHistoryFilters({
      pet: PET_A,
      from: "2026-08-01",
      to: "2026-09-30",
      type: "vaccine",
      knownPetIds: [PET_A, PET_B],
    });
    const result = filterFamilyHistoryItems(SAMPLE, filters);
    assert.deepEqual(
      result.map((row) => row.id),
      ["3"],
    );
  });

  it("N. URL encodes filters for refresh/reproducibility", () => {
    const filters = resolveFamilyHistoryFilters({
      pet: PET_A,
      from: "2026-08-20",
      to: "2026-09-07",
      type: "weight",
      knownPetIds: [PET_A],
    });
    assert.equal(
      familyHistoryHref(filters),
      "/historico?pet=pet-a&from=2026-08-20&to=2026-09-07&type=weight",
    );
    assert.equal(familyHistoryHref(resolveFamilyHistoryFilters({})), "/historico");
  });

  it("O. returnTo preserves filter query safely", () => {
    const href = familyHistoryHref(
      resolveFamilyHistoryFilters({
        pet: PET_A,
        from: "2026-08-20",
        to: "2026-09-07",
        type: "feeding",
        knownPetIds: [PET_A],
      }),
    );
    assert.equal(resolveReturnTo(href), href);
    assert.equal(safeReturnPath(href, "/"), href);
    assert.equal(decodeURIComponent(encodeURIComponent(href)), href);
  });

  it("P. empty state when filters match nothing", () => {
    const filters = resolveFamilyHistoryFilters({ type: "consultation" });
    assert.deepEqual(filterFamilyHistoryItems(SAMPLE, filters), []);
  });

  it("ignores unknown pet ids and invalid type", () => {
    const filters = resolveFamilyHistoryFilters({
      pet: "missing",
      type: "nope",
      knownPetIds: [PET_A],
    });
    assert.equal(filters.petId, null);
    assert.equal(filters.type, "all");
  });

  it("swaps inverted from/to", () => {
    const filters = resolveFamilyHistoryFilters({ from: "2026-09-07", to: "2026-08-01" });
    assert.equal(filters.from, "2026-08-01");
    assert.equal(filters.to, "2026-09-07");
  });

  it("G. home preview limit is 3 (not a metric)", () => {
    assert.equal(HOME_ACTIVITY_PREVIEW_LIMIT, 3);
    assert.equal(FAMILY_HISTORY_FETCH_LIMIT, 500);
  });
});

describe("home + navigation contracts", () => {
  it("A/B/C/D/E/F/H. home composition after simplification", () => {
    const home = readSrc("app/(app)/page.tsx");
    assert.equal(home.includes("HomeFamilyStats"), false);
    assert.equal(home.includes("Meus pets"), false);
    assert.equal(home.includes("HomeAgendaPanel"), false);
    assert.equal(home.includes("listUpcomingReminders"), false);
    assert.ok(home.includes("HomeAssistantCard"));
    assert.ok(home.includes("HomeCareAlerts"));
    assert.ok(home.includes("Filhotes em acompanhamento"));
    assert.ok(home.includes("HOME_ACTIVITY_PREVIEW_LIMIT"));
    assert.ok(home.includes('href="/historico"'));
    assert.ok(home.includes("O que aconteceu por aqui"));
  });

  it("D. assistant card points to /assistant with honest copy", () => {
    const card = readSrc("components/home-assistant-card.tsx");
    assert.ok(card.includes('href="/assistant"'));
    assert.ok(card.includes("Pergunte aos seus registros"));
    assert.ok(card.includes("Abrir assistente"));
    assert.equal(card.toLowerCase().includes("ia generativa"), false);
  });

  it("Q. desktop sidebar has Início + Histórico", () => {
    const sidebar = readSrc("components/desktop-sidebar.tsx");
    assert.ok(sidebar.includes('label: "Início"'));
    assert.ok(sidebar.includes('href: "/historico"'));
    assert.ok(sidebar.includes('label: "Histórico"'));
    assert.equal(sidebar.includes("Visão geral"), false);
  });

  it("R/T. mobile Mais has Histórico + Neonatal; bottom nav keeps Agenda/Pets", () => {
    const more = readSrc("app/(app)/more/page.tsx");
    assert.ok(more.includes('href: "/historico"'));
    assert.ok(more.includes('href: "/neonatal"'));
    assert.ok(more.includes("Recursos"));
    assert.ok(more.includes("Conta"));
    const bottom = readSrc("components/bottom-nav.tsx");
    assert.ok(bottom.includes('href: "/pets"'));
    assert.ok(bottom.includes('href: "/agenda"'));
    assert.ok(bottom.includes('href: "/more"'));
  });

  it("S. Settings no longer links Meus pets as a functional shortcut", () => {
    const settings = readSrc("app/(app)/settings/page.tsx");
    assert.equal(settings.includes('href: "/pets"'), false);
    assert.equal(settings.includes("Meus pets"), false);
    assert.ok(settings.includes("Família e membros"));
    assert.ok(settings.includes("Privacidade e exportação"));
  });
});
