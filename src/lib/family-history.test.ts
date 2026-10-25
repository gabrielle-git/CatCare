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

  it("N. shell contract B: five primary destinations including Registrar; Início not Agora", () => {
    assert.deepEqual(
      PRIMARY_NAV.map(({ id, label, href }) => ({ id, label, href })),
      [
        { id: "inicio", label: "Início", href: "/" },
        { id: "pets", label: "Pets", href: "/pets" },
        { id: "registrar", label: "Registrar", href: "/records/new" },
        { id: "cuidados", label: "Cuidados", href: "/cuidados" },
        { id: "financas", label: "Finanças", href: "/financas" },
      ],
    );
    assert.equal(PRIMARY_NAV.find((item) => item.id === "registrar")?.action, true);
    assert.equal(REGISTER_ACTION.href, "/records/new");
    assert.equal(REGISTER_ACTION.label, "Registrar cuidado");
    assert.equal(MORE_ACTION.href, "/more");
    assert.equal(ASSISTANT_UTILITY.href, "/assistant");
    assert.equal(ACCOUNT_LINK.href, MORE_MENU_ACCOUNT.href);
    const primaryHrefs = PRIMARY_NAV.map((item) => item.href);
    for (const href of [MORE_ACTION.href, ASSISTANT_UTILITY.href, ACCOUNT_LINK.href, "/memories", "/agenda"]) {
      assert.equal(primaryHrefs.includes(href), false, `${href} must not be a primary destination`);
    }
  });

  it("O. mobile B: five-destination dock with Registrar inside; Assistente/Conta in header", () => {
    const bottom = readSrc("components/bottom-nav.tsx");
    assert.ok(bottom.includes("lg:hidden"));
    assert.ok(bottom.includes("cd-app-dock-b"));
    assert.equal(bottom.includes("cd-mob-dock-4"), false);
    assert.equal(bottom.includes("cd-mob-action-strip"), false);
    assert.equal(bottom.includes("MoreMenuSheet"), false);

    const dock = bottom.slice(bottom.indexOf("<nav"), bottom.indexOf("</nav>"));
    assert.ok(dock.includes("PRIMARY_NAV.map"));
    assert.ok(dock.includes('data-nav={item.id}'));

    const header = readSrc("components/mobile-header.tsx");
    assert.ok(header.includes("lg:hidden"));
    assert.ok(header.includes("ASSISTANT_UTILITY.href"));
    assert.ok(header.includes("ACCOUNT_LINK.href"));
    assert.equal(header.includes("MoreMenuSheet"), false);
    assert.equal(header.includes("Abrir menu Mais"), false);
  });

  it("P–Y. M1B.3: Mais trigger gone; Memórias lives in Pets; /more still routable", () => {
    const sheet = readSrc("components/more-menu-sheet.tsx");
    assert.ok(sheet.includes("Mais recursos"));
    assert.ok(sheet.includes('aria-label="Fechar menu Mais"'));
    assert.ok(sheet.includes("showModal"));

    assert.deepEqual(MORE_MENU_GROUPS, []);
    assert.equal(MORE_MENU_ACCOUNT.label, "Conta e família");
    assert.equal(MORE_MENU_ACCOUNT.href, "/settings");
    assert.equal(isMoreMenuPath("/memories"), false);
    assert.ok(isMoreMenuPath("/more"));
    assert.equal(isMoreMenuPath("/agenda"), false);
    assert.equal(isMoreMenuPath("/expenses"), false);
    assert.equal(isMoreMenuPath("/settings"), false);
    assert.equal(isMoreMenuPath("/historico"), false);
  });

  it("Z. desktop rail B: brand, Assistente, five destinations, Conta; Mais trigger removed", () => {
    const sidebar = readSrc("components/desktop-sidebar.tsx");
    assert.ok(sidebar.includes("hidden") && sidebar.includes("lg:block"));
    for (const token of ["FinalLogoImg", "ASSISTANT_UTILITY.href", "PRIMARY_NAV.map", "ACCOUNT_LINK.href", "isRecordEditPath", "LOGO_WIDTH"]) {
      assert.ok(sidebar.includes(token), `missing ${token}`);
    }
    assert.equal(sidebar.includes("MoreMenuPopover"), false);
    assert.equal(sidebar.includes("Abrir menu Mais"), false);
    assert.equal(sidebar.includes("MoreMenuSheet"), false);
    assert.ok(sidebar.includes("data-nav={item.id}"));
    assert.equal(PRIMARY_NAV[0].label, "Início");
    const link = readSrc("components/shell-nav-link.tsx");
    assert.ok(link.includes("prefetch={false}"));
    assert.ok(link.includes("<a href={href}"));
  });

  it("active route contract B", () => {
    const cases: [string, ReturnType<typeof resolveShellTarget>][] = [
      ["/", "inicio"],
      ["/pets", "pets"],
      ["/pets/new", "pets"],
      ["/pets/abc", "pets"],
      ["/pets/abc/historico", "pets"],
      ["/pets/abc/neonatal-history", "pets"],
      ["/cuidados", "cuidados"],
      ["/historico", "cuidados"],
      ["/agenda", "cuidados"],
      ["/agenda/abc/edit", "cuidados"],
      ["/routines/abc", "cuidados"],
      ["/neonatal/historico", "cuidados"],
      ["/financas", "financas"],
      ["/expenses", "financas"],
      ["/shopping/products/abc/edit", "financas"],
      ["/health-plan/guides/abc", "financas"],
      ["/memories/new", "pets"],
      ["/records/new", "registrar"],
      ["/records/abc/edit", null],
      ["/assistant", "assistant"],
      ["/settings/members", "account"],
      ["/more", "more"],
      ["/petsitter", null],
    ];
    for (const [pathname, expected] of cases) {
      assert.equal(resolveShellTarget(pathname), expected, pathname);
    }
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
