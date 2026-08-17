import { Scale } from "lucide-react";
import Link from "next/link";
import { formatShortDate, formatWeight } from "@/lib/format";

export type WeightChartPoint = { date: string; grams: number };

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 18, right: 16, bottom: 36, left: 52 };

function kgLabel(grams: number) {
  const kg = grams / 1000;
  const digits = kg < 1 ? 3 : 2;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(kg);
}

export function WeightChart({
  data,
  petId,
  petName,
}: {
  data: WeightChartPoint[];
  petId: string;
  petName: string;
}) {
  if (data.length === 0) {
    return (
      <section className="cat-card p-5 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Acompanhamento</p>
        <h2 className="mt-1 text-xl font-bold">Evolução do peso</h2>
        <div className="mt-4 rounded-[20px] border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <Scale className="mx-auto text-[var(--lavender-strong)]" size={22} />
          <p className="mt-3 text-sm font-semibold">Ainda não há pesagens de {petName}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Com duas ou mais medidas, o gráfico mostra a curva em kg.</p>
          <Link href={`/records/new?pet=${petId}&type=weight`} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-2xl bg-[var(--lavender-soft)] px-4 py-2.5 text-xs font-bold text-[var(--lavender-strong)]">Registrar peso</Link>
        </div>
      </section>
    );
  }

  const grams = data.map((point) => point.grams);
  const minRaw = Math.min(...grams);
  const maxRaw = Math.max(...grams);
  const pad = Math.max((maxRaw - minRaw) * 0.18, minRaw * 0.04, 40);
  const min = Math.max(0, minRaw - pad);
  const max = maxRaw + pad;
  const span = max - min || 1;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (index: number) => PAD.left + (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
  const yAt = (value: number) => PAD.top + ((max - value) / span) * innerH;
  const points = data.map((point, index) => `${xAt(index).toFixed(1)},${yAt(point.grams).toFixed(1)}`).join(" ");
  const area = `${PAD.left},${PAD.top + innerH} ${points} ${xAt(data.length - 1).toFixed(1)},${PAD.top + innerH}`;
  const ticks = [max, min + span / 2, min];
  const first = data[0];
  const last = data[data.length - 1];
  const delta = last.grams - first.grams;
  const deltaLabel = delta === 0 ? "estável" : `${delta > 0 ? "+" : "−"}${formatWeight(Math.abs(delta)).replace(" kg", "")} kg`;

  return (
    <section className="cat-card p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Acompanhamento</p>
          <h2 className="mt-1 text-xl font-bold">Evolução do peso</h2>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{formatWeight(last.grams)}</p>
          <p className="text-[11px] font-semibold text-[var(--muted)]">{data.length} {data.length === 1 ? "pesagem" : "pesagens"} · {deltaLabel}</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-4 h-auto w-full" role="img" aria-label={`Gráfico de peso de ${petName}`}>
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8e7dbe" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8e7dbe" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--border)" strokeDasharray="4 6" />
            <text x={PAD.left - 8} y={yAt(tick) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">{kgLabel(tick)}</text>
          </g>
        ))}
        {data.length > 1 && <polygon points={area} fill="url(#weightFill)" />}
        {data.length > 1 && <polyline points={points} fill="none" stroke="#8e7dbe" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {data.map((point, index) => (
          <circle key={`${point.date}-${index}`} cx={xAt(index)} cy={yAt(point.grams)} r="5" fill="#fff" stroke="#7663ad" strokeWidth="2.5">
            <title>{`${formatShortDate(point.date)} · ${formatWeight(point.grams)}`}</title>
          </circle>
        ))}
        <text x={xAt(0)} y={HEIGHT - 10} textAnchor={data.length === 1 ? "middle" : "start"} className="fill-[var(--muted)] text-[11px]">{formatShortDate(first.date)}</text>
        {data.length > 1 && <text x={xAt(data.length - 1)} y={HEIGHT - 10} textAnchor="end" className="fill-[var(--muted)] text-[11px]">{formatShortDate(last.date)}</text>}
      </svg>
    </section>
  );
}
