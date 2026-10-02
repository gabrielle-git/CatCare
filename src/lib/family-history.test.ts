import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
  FAMILY_HISTORY_FETCH_LIMIT,
  HOME_ACTIVITY_PREVIEW_LIMIT,
  buildTimelineSearchText,
  familyHistoryHasAdvancedFilters,
  familyHistoryHref,
  filterFamilyHistoryItems,
  normalizeSearchText,
  resolveFamilyHistoryFilters,
  timelineItemMatchesQuery,
} from "./family-history";
import {
  ACCOUNT_LINK,
  ASSISTANT_UTILITY,
  MORE_ACTION,
  PRIMARY_NAV,
  REGISTER_ACTION,
  isMobileMoreActive,
  resolveShellTarget,
} from "./app-navigation";
import { MORE_MENU_ACCOUNT, MORE_MENU_GROUPS, isMoreMenuPath } from "./more-menu";
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
const NAMES = { [PET_A]: "Gwen", [PET_B]: "Hinata" };

const SAMPLE: TimelineItem[] = [
  item({
    id: "1",
    pet_id: PET_A,
    kind: "feeding",
    title: "Alimentação",
    detail: "Leite materno 12 ml",
    occurred_at: "2026-09-07T08:00:00-03:00",
    source: "neonatal",
  }),
  item({
    id: "2",
    pet_id: PET_B,
    kind: "weight",
    title: "Pesagem",
    detail: "285 g",
    occurred_at: "2026-09-06T10:00:00-03:00",
    source: "weight",
  }),
  item({
    id: "3",
    pet_id: PET_A,
    kind: "vaccine",
    title: "Vacina antirrábica",
    detail: "Clínica Vet Vida",
    occurred_at: "2026-08-20T15:00:00-03:00",
    source: "health",
  }),
  item({
    id: "4",
    pet_id: PET_B,
    kind: "feeding",
    title: "Alimentação",
    detail: "Sachê frango",
    occurred_at: "2026-09-01T07:00:00-03:00",
    source: "neonatal",
  }),
  item({
    id: "5",
    pet_id: PET_A,
    kind: "observation",
    title: "Nota",
    detail: "Mamadeira no meio da noite",
    occurred_at: "2026-07-01T12:00:00-03:00",
    source: "neonatal",
  }),
  item({
    id: "6",
    pet_id: PET_B,
    kind: "deworming",
    title: "Vermífugo",
    detail: "Dose mensal",
    occurred_at: "2026-08-12T11:00:00-03:00",
    source: "health",
  }),
];

function readSrc(relative: string) {
  return readFileSync(join(process.cwd(), "src", relative), "utf8");
}

describe("family history helpers", () => {
  it("keeps multi-pet records without pet chip filter", () => {
    const filters = resolveFamilyHistoryFilters({});
    const result = filterFamilyHistoryItems(SAMPLE, filters, NAMES);
    assert.equal(result.length, SAMPLE.length);
    assert.ok(result.some((row) => row.pet_id === PET_A));
    assert.ok(result.some((row) => row.pet_id === PET_B));
  });

  it("B. empty search shows all", () => {
    const filters = resolveFamilyHistoryFilters({ q: "   " });
    assert.equal(filterFamilyHistoryItems(SAMPLE, filters, NAMES).length, SAMPLE.length);
  });

  it("C. search leite", () => {
    const filters = resolveFamilyHistoryFilters({ q: "leite" });
    const result = filterFamilyHistoryItems(SAMPLE, filters, NAMES);
    assert.deepEqual(
      result.map((row) => row.id),
      ["1"],
    );
  });

  it("D. search in notes/detail", () => {
    const filters = resolveFamilyHistoryFilters({ q: "mamadeira" });
    assert.deepEqual(
      filterFamilyHistoryItems(SAMPLE, filters, NAMES).map((row) => row.id),
      ["5"],
    );
  });

  it("E. search is case-insensitive", () => {
    const filters = resolveFamilyHistoryFilters({ q: "SACHÊ" });
    assert.equal(filterFamilyHistoryItems(SAMPLE, filters, NAMES).length, 1);
  });

  it("F. search is accent-tolerant", () => {
    assert.equal(normalizeSearchText("Sachê"), normalizeSearchText("sache"));
    assert.ok(timelineItemMatchesQuery(SAMPLE[3], "sache", NAMES));
    assert.ok(timelineItemMatchesQuery(SAMPLE[2], "antirrabica", NAMES));
  });

  it("G. search + type", () => {
    const filters = resolveFamilyHistoryFilters({ q: "leite", type: "feeding" });
    assert.deepEqual(
      filterFamilyHistoryItems(SAMPLE, filters, NAMES).map((row) => row.id),
      ["1"],
    );
    const mismatch = resolveFamilyHistoryFilters({ q: "leite", type: "vaccine" });
    assert.deepEqual(filterFamilyHistoryItems(SAMPLE, mismatch, NAMES), []);
  });

  it("H. search + period", () => {
    const filters = resolveFamilyHistoryFilters({ q: "alimentação", from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual(
      filterFamilyHistoryItems(SAMPLE, filters, NAMES)
        .map((row) => row.id)
        .sort(),
      ["1", "4"],
    );
  });

  it("I. search + type + period", () => {
    const filters = resolveFamilyHistoryFilters({
      q: "leite",
      from: "2026-08-01",
      to: "2026-08-31",
      type: "feeding",
    });
    assert.deepEqual(filterFamilyHistoryItems(SAMPLE, filters, NAMES), []);

    const hit = resolveFamilyHistoryFilters({
      q: "leite",
      from: "2026-09-01",
      to: "2026-09-30",
      type: "feeding",
    });
    assert.deepEqual(
      filterFamilyHistoryItems(SAMPLE, hit, NAMES).map((row) => row.id),
      ["1"],
    );
  });

  it("J/K. q/from/to/type persist in URL and returnTo", () => {
    const filters = resolveFamilyHistoryFilters({
      q: "leite",
      from: "2026-08-01",
      to: "2026-08-31",
      type: "feeding",
    });
    const href = familyHistoryHref(filters);
    assert.equal(href, "/historico?q=leite&from=2026-08-01&to=2026-08-31&type=feeding");
    assert.equal(resolveReturnTo(href), href);
    assert.equal(safeReturnPath(href, "/"), href);
  });

  it("finds pet name via searchable text without pet chips", () => {
    const filters = resolveFamilyHistoryFilters({ q: "Gwen" });
    const result = filterFamilyHistoryItems(SAMPLE, filters, NAMES);
    assert.ok(result.every((row) => row.pet_id === PET_A));
    assert.ok(buildTimelineSearchText(SAMPLE[0], NAMES).includes("Gwen"));
  });

  it("advanced filters flag ignores search-only", () => {
    assert.equal(familyHistoryHasAdvancedFilters(resolveFamilyHistoryFilters({ q: "leite" })), false);
    assert.equal(familyHistoryHasAdvancedFilters(resolveFamilyHistoryFilters({ type: "weight" })), true);
  });

  it("G home preview limit remains 3", () => {
    assert.equal(HOME_ACTIVITY_PREVIEW_LIMIT, 3);
    assert.equal(FAMILY_HISTORY_FETCH_LIMIT, 500);
  });
});

describe("family history + more navigation contracts", () => {
  it("A/L/M. historico UI has search, collapsed filters, no pet chips, single count ownership", () => {
    const panel = readSrc("components/family-history-panel.tsx");
    assert.equal(panel.includes("Todos os pets"), false);
    assert.equal(panel.includes("initialPet"), false);
    assert.ok(panel.includes("Buscar por leite, vacina, consulta"));
    assert.ok(panel.includes("Filtros"));
    assert.equal(panel.includes("ChevronDown"), false);
    assert.ok(panel.includes("useState(advancedOpenDefault)"));
    assert.ok(panel.includes("showResultCount={false}"));
    assert.ok(panel.includes("resultado"));
    assert.equal(panel.includes("em todo o histórico carregado"), false);
    assert.ok(panel.includes("flex w-full items-center gap-2.5"));
    assert.equal(panel.includes("absolute left-"), false);
  });

  it("N. shell contract: exactly four primary destinations; Registrar, Mais and Assistente are not tabs", () => {
    assert.deepEqual(
      PRIMARY_NAV.map(({ id, label, href }) => ({ id, label, href })),
      [
        { id: "agora", label: "Agora", href: "/" },
        { id: "pets", label: "Pets", href: "/pets" },
        { id: "cuidados", label: "Cuidados", href: "/historico" },
        { id: "memorias", label: "Memórias", href: "/memories" },
      ],
    );
    const primaryHrefs = PRIMARY_NAV.map((item) => item.href);
    assert.equal(REGISTER_ACTION.href, "/records/new");
    assert.equal(REGISTER_ACTION.label, "Registrar cuidado");
    assert.equal(MORE_ACTION.href, "/more");
    assert.equal(ASSISTANT_UTILITY.href, "/assistant");
    for (const href of [REGISTER_ACTION.href, MORE_ACTION.href, ASSISTANT_UTILITY.href, ACCOUNT_LINK.href, "/agenda"]) {
      assert.equal(primaryHrefs.includes(href), false, `${href} must not be a primary destination`);
    }
    assert.equal(ACCOUNT_LINK.href, MORE_MENU_ACCOUNT.href);
  });

  it("O. mobile: dock renders the four destinations; Registrar cuidado and Mais sit outside the dock", () => {
    const bottom = readSrc("components/bottom-nav.tsx");
    assert.ok(bottom.includes("lg:hidden"));
    assert.ok(bottom.includes("cd-mob-dock-4"));
    assert.ok(bottom.includes("cd-mob-action-strip"));
    assert.ok(bottom.includes("MoreMenuSheet"));
    assert.ok(bottom.includes("Abrir menu Mais"));
    assert.equal(bottom.includes("grid-cols-5"), false);
    assert.equal(bottom.includes('label: "Agenda"'), false);

    const dock = bottom.slice(bottom.indexOf("<nav"), bottom.indexOf("</nav>"));
    assert.ok(dock.includes("PRIMARY_NAV.map"));
    assert.equal(dock.includes("REGISTER_ACTION"), false, "Registrar must not be a dock tab");
    assert.equal(dock.includes("MORE_ACTION"), false, "Mais must not be a dock tab");

    const strip = bottom.slice(bottom.indexOf("cd-mob-action-strip"), bottom.indexOf("<nav"));
    assert.ok(strip.includes("REGISTER_ACTION.href"));
    assert.ok(strip.includes("MORE_ACTION.label"));

    const header = readSrc("components/mobile-header.tsx");
    assert.ok(header.includes("lg:hidden"));
    assert.ok(header.includes("ASSISTANT_UTILITY.href"));
  });

  it("P–Y. Mais groups secondary resources: Cuidados areas, Casa e finanças, Conta", () => {
    const sheet = readSrc("components/more-menu-sheet.tsx");
    assert.ok(sheet.includes("Mais recursos"));
    assert.ok(sheet.includes('aria-label="Fechar menu Mais"'));
    assert.ok(sheet.includes("showModal"));

    assert.deepEqual(
      MORE_MENU_GROUPS.map((group) => ({ label: group.label, items: group.items.map((item) => [item.label, item.href]) })),
      [
        {
          label: "Cuidados",
          items: [["Agenda", "/agenda"], ["Rotinas", "/routines"], ["Neonatal", "/neonatal"], ["Plano de saúde", "/health-plan"]],
        },
        { label: "Casa e finanças", items: [["Gastos", "/expenses"], ["Compras", "/shopping"]] },
      ],
    );
    const labels = MORE_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    for (const label of ["Memórias", "Assistente", "Histórico"]) {
      assert.equal(labels.includes(label), false, `${label} belongs to the shell, not Mais`);
    }
    assert.equal(MORE_MENU_ACCOUNT.label, "Conta e família");
    assert.equal(MORE_MENU_ACCOUNT.href, "/settings");
    assert.ok(isMoreMenuPath("/agenda"));
    assert.ok(isMoreMenuPath("/neonatal/historico"));
    assert.ok(isMoreMenuPath("/expenses"));
    assert.ok(isMoreMenuPath("/settings/members"));
    assert.equal(isMoreMenuPath("/historico"), false);
    assert.equal(isMoreMenuPath("/memories"), false);
  });

  it("Z. desktop rail: brand, Assistente, four destinations, Registrar, Mais popover, Conta; record-edit safety kept", () => {
    const sidebar = readSrc("components/desktop-sidebar.tsx");
    assert.ok(sidebar.includes("hidden") && sidebar.includes("lg:block"));
    for (const token of ["FinalLogoImg", "ASSISTANT_UTILITY.href", "PRIMARY_NAV.map", "REGISTER_ACTION.href", "MoreMenuPopover", "ACCOUNT_LINK.href", "isRecordEditPath"]) {
      assert.ok(sidebar.includes(token), `missing ${token}`);
    }
    assert.equal(sidebar.includes("MoreMenuSheet"), false);
    assert.equal(sidebar.includes('label: "Início"'), false);
    const link = readSrc("components/shell-nav-link.tsx");
    assert.ok(link.includes("prefetch={false}"));
    assert.ok(link.includes("<a href={href}"));
  });

  it("active route contract", () => {
    const cases: [string, ReturnType<typeof resolveShellTarget>][] = [
      ["/", "agora"],
      ["/pets", "pets"],
      ["/pets/new", "pets"],
      ["/pets/abc", "pets"],
      ["/pets/abc/historico", "pets"],
      ["/pets/abc/neonatal-history", "pets"],
      ["/historico", "cuidados"],
      ["/agenda", "cuidados"],
      ["/agenda/abc/edit", "cuidados"],
      ["/routines/abc", "cuidados"],
      ["/neonatal/historico", "cuidados"],
      ["/health-plan/guides/abc", "cuidados"],
      ["/memories/new", "memorias"],
      ["/records/new", "register"],
      ["/records/abc/edit", null],
      ["/assistant", "assistant"],
      ["/settings/members", "account"],
      ["/expenses", "more"],
      ["/shopping/products/abc/edit", "more"],
      ["/more", "more"],
      ["/petsitter", null],
    ];
    for (const [pathname, expected] of cases) {
      assert.equal(resolveShellTarget(pathname), expected, pathname);
    }
    assert.ok(isMobileMoreActive("account"));
    assert.ok(isMobileMoreActive("more"));
    assert.equal(isMobileMoreActive("cuidados"), false);
  });

  it("home composition still simplified", () => {
    const home = readSrc("app/(app)/page.tsx");
    assert.equal(home.includes("HomeFamilyStats"), false);
    assert.equal(home.includes("HomeAgendaPanel"), false);
    assert.ok(home.includes("HomeAssistantCard"));
    assert.ok(home.includes("HomeCareAlerts"));
  });

  it("Settings still without Meus pets shortcut", () => {
    const settings = readSrc("app/(app)/settings/page.tsx");
    assert.equal(settings.includes('href: "/pets"'), false);
    assert.equal(settings.includes("Meus pets"), false);
  });
});
