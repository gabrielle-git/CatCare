import {
  ARCHITECTURE_MODULES,
  ARCHITECTURE_NOTES,
  HOME_PRIORITIES,
  OUTSIDE_PRODUCT_MAP,
  PRIMARY_ACTIONS,
  TRANSVERSAL_UTILITIES,
} from "@/components/brand/cuidadim/product-architecture";

/**
 * Fase 1 — correção final da Product Architecture.
 * Sem shells, sem Home mock, sem nav visual.
 */
export function ProductArchitectureLab() {
  return (
    <div className="space-y-10">
      <div className="cd-alert cd-alert-accent">
        <strong>Fase 1 · correção final.</strong> Só arquitetura conceitual. Sem mocks. Sem Fase 2.
      </div>

      <div className="cd-alert">
        <strong>Importante:</strong> {ARCHITECTURE_NOTES.domainsAreNotNav}
      </div>

      {/* Final conceptual map */}
      <div>
        <h3 className="cd-h3">Mapa conceitual final</h3>
        <p className="cd-small mt-2 max-w-[40rem]">
          Domínios por objetivo do usuário — não itens de navegação.
        </p>
        <div className="mt-5 space-y-4">
          {ARCHITECTURE_MODULES.map((mod) => (
            <div key={mod.id} className="cd-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="cd-h3">{mod.name}</span>
                {mod.uiLabel ? (
                  <span className="cd-meta">UI: {mod.uiLabel}</span>
                ) : null}
                <span
                  className="cd-status"
                  data-status={
                    mod.priority === "primary"
                      ? "APPROVED"
                      : mod.priority === "secondary"
                        ? "CANDIDATE"
                        : "LEGACY"
                  }
                >
                  {mod.priority}
                </span>
                {mod.namingStatus ? (
                  <span className="cd-status" data-status="AMBIGUOUS">
                    {mod.namingStatus}
                  </span>
                ) : null}
              </div>
              <pre className="cd-small mt-3 overflow-x-auto whitespace-pre font-mono text-[var(--text-secondary)]">
                {mod.name}
                {"\n"}
                {mod.tree.map((line) => `├── ${line}`).join("\n")}
              </pre>
              {mod.priorityNote ? (
                <p className="cd-small mt-3 text-[var(--cuidadim-purple)]">{mod.priorityNote}</p>
              ) : null}
            </div>
          ))}

          <div className="cd-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="cd-h3">Utilidades transversais</span>
              <span className="cd-status" data-status="CANDIDATE">
                transversal
              </span>
            </div>
            <pre className="cd-small mt-3 whitespace-pre font-mono text-[var(--text-secondary)]">
              UTILIDADES TRANSVERSAIS
              {"\n"}
              {TRANSVERSAL_UTILITIES.map((u) => `└── ${u.name}`).join("\n")}
            </pre>
            {TRANSVERSAL_UTILITIES.map((u) => (
              <p key={u.id} className="cd-small mt-2">
                <strong className="font-semibold text-[var(--text)]">{u.classification}:</strong>{" "}
                {u.note}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Module table */}
      <div>
        <h3 className="cd-h3">Módulo · prioridade · propósito</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="cd-label py-2 pr-3 font-normal">Módulo</th>
                <th className="cd-label py-2 pr-3 font-normal">Prioridade</th>
                <th className="cd-label py-2 font-normal">Propósito</th>
              </tr>
            </thead>
            <tbody>
              {ARCHITECTURE_MODULES.map((mod) => (
                <tr key={mod.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{mod.name}</p>
                    {mod.uiLabel ? <p className="cd-meta">UI: {mod.uiLabel}</p> : null}
                    {mod.namingStatus ? (
                      <span className="cd-status mt-1 inline-block" data-status="AMBIGUOUS">
                        {mod.namingStatus}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className="cd-status"
                      data-status={
                        mod.priority === "primary"
                          ? "APPROVED"
                          : mod.priority === "secondary"
                            ? "CANDIDATE"
                            : "LEGACY"
                      }
                    >
                      {mod.priority}
                    </span>
                    {mod.priorityNote ? (
                      <p className="cd-meta mt-1.5 max-w-[14rem]">{mod.priorityNote}</p>
                    ) : null}
                  </td>
                  <td className="cd-small py-2.5 text-[var(--text-secondary)]">{mod.purpose}</td>
                </tr>
              ))}
              {PRIMARY_ACTIONS.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{a.name}</p>
                    <span className="cd-status mt-1 inline-block" data-status="APPROVED">
                      {a.classification}
                    </span>
                  </td>
                  <td className="cd-meta py-2.5 pr-3">em {a.livesIn}</td>
                  <td className="cd-small py-2.5 text-[var(--text-secondary)]">{a.note}</td>
                </tr>
              ))}
              {TRANSVERSAL_UTILITIES.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold">{u.name}</p>
                    <span className="cd-status mt-1 inline-block" data-status="CANDIDATE">
                      {u.classification}
                    </span>
                  </td>
                  <td className="cd-meta py-2.5 pr-3">transversal</td>
                  <td className="cd-small py-2.5 text-[var(--text-secondary)]">{u.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Removals / gates */}
      <div>
        <h3 className="cd-h3">Correções desta rodada</h3>
        <ul className="cd-small mt-3 space-y-1.5">
          {ARCHITECTURE_NOTES.removed.map((item) => (
            <li key={item}>· Removido / corrigido: {item}</li>
          ))}
          <li>
            · <strong>Casa / Finanças</strong> — status{" "}
            <span className="cd-status" data-status="AMBIGUOUS">
              NAMING TO RESOLVE
            </span>
          </li>
          {OUTSIDE_PRODUCT_MAP.map((item) => (
            <li key={item.id}>
              · Fora do mapa: <strong>{item.name}</strong> — {item.reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Home priorities */}
      <div>
        <h3 className="cd-h3">Prioridades da Home</h3>
        <p className="cd-small mt-2 max-w-[40rem]">
          Hierarquia mantida — só raciocínio, sem mock.
        </p>
        <ol className="mt-5 space-y-3">
          {HOME_PRIORITIES.map((p) => (
            <li key={p.order} className="cd-panel p-4">
              <p className="cd-label">Pergunta {p.order}</p>
              <p className="cd-h3 mt-1">{p.question}</p>
              <p className="cd-small mt-2">
                <strong className="font-semibold text-[var(--text)]">Mapeia para:</strong> {p.mapsTo}
              </p>
              <p className="cd-small mt-1.5 text-[var(--cuidadim-purple)]">
                <strong>Fazer:</strong> {p.do}
              </p>
              <p className="cd-small mt-1 text-[var(--text-secondary)]">
                <strong>Evitar:</strong> {p.dont}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="cd-module-soft p-5">
        <p className="cd-label">Fase 2 · ainda bloqueada</p>
        <p className="cd-small mt-2">{ARCHITECTURE_NOTES.phase2Gate}</p>
      </div>
    </div>
  );
}
