import { useMemo } from "react";

type Point = { date: string; count: number; replies?: number; rate?: number };

export default function DailySendChart({ data }: { data: Point[] }) {
  const { sendPath, sendArea, ratePath, max, total, totalReplies, avgRate, labels } = useMemo(() => {
    const w = 280;
    const h = 60;
    const pad = 4;
    const n = data.length || 1;
    const max = Math.max(1, ...data.map((d) => d.count));
    const total = data.reduce((s, d) => s + d.count, 0);
    const totalReplies = data.reduce((s, d) => s + (d.replies || 0), 0);
    const avgRate = total > 0 ? Math.round((totalReplies / total) * 100) : 0;
    const stepX = (w - pad * 2) / Math.max(1, n - 1);

    const sendPoints = data.map((d, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (d.count / max) * (h - pad * 2);
      return [x, y] as const;
    });
    const sendPath = sendPoints
      .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
      .join(" ");
    const sendArea = sendPoints.length
      ? `${sendPath} L${sendPoints[sendPoints.length - 1][0]},${h - pad} L${sendPoints[0][0]},${h - pad} Z`
      : "";

    // response rate line (0-100% scaled to same height)
    const ratePoints = data.map((d, i) => {
      const x = pad + i * stepX;
      const r = Math.max(0, Math.min(100, d.rate || 0));
      const y = h - pad - (r / 100) * (h - pad * 2);
      return [x, y] as const;
    });
    const ratePath = ratePoints
      .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
      .join(" ");

    const labels = data.map((d) => {
      const dt = new Date(d.date + "T12:00:00");
      const wd = dt.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3).replace(".", "").toUpperCase();
      const dd = dt.getDate().toString().padStart(2, "0");
      const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
      return { wd, dm: `${dd}/${mm}` };
    });
    return { sendPath, sendArea, ratePath, max, total, totalReplies, avgRate, labels };
  }, [data]);

  if (!data.length || total === 0) {
    return (
      <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Disparos / dia
          </span>
          <span className="text-[10px] text-muted-foreground">7 dias</span>
        </div>
        <p className="text-[11px] text-muted-foreground italic">Sem envios nos últimos 7 dias</p>
      </div>
    );
  }

  return (
    <div className="bg-secondary/40 rounded-xl p-3 border border-border/50">
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Disparos / dia
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="font-semibold text-foreground">
            {total} envios <span className="text-muted-foreground font-normal">· pico {max}</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {avgRate}% resp.
          </span>
        </div>
      </div>
      <svg viewBox="0 0 280 60" className="w-full h-14 overflow-visible">
        <defs>
          <linearGradient id="dailyArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Envios */}
        <path d={sendArea} fill="url(#dailyArea)" />
        <path
          d={sendPath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Taxa de resposta */}
        <path
          d={ratePath}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 2"
        />
        {data.map((d, i) => {
          const x = 4 + i * ((280 - 8) / Math.max(1, data.length - 1));
          const y = 60 - 4 - (d.count / max) * (60 - 8);
          const rate = Math.max(0, Math.min(100, d.rate || 0));
          const yr = 60 - 4 - (rate / 100) * (60 - 8);
          return (
            <g key={i}>
              {/* label envios */}
              <text
                x={x}
                y={y - 5}
                textAnchor="middle"
                fill="hsl(var(--primary))"
                fontSize="8"
                fontWeight="600"
                opacity={d.count > 0 ? 1 : 0.4}
              >
                {d.count}
              </text>
              <circle cx={x} cy={y} r={d.count > 0 ? 2 : 1.2} fill="hsl(var(--primary))" />
              {/* ponto taxa */}
              {d.count > 0 && (
                <>
                  <circle cx={x} cy={yr} r="1.6" fill="rgb(16 185 129)" />
                  <text
                    x={x}
                    y={yr - 4}
                    textAnchor="middle"
                    fill="rgb(16 185 129)"
                    fontSize="7"
                    fontWeight="600"
                  >
                    {rate}%
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="relative mt-1 h-6">
        {labels.map((l, i) => {
          const pct = ((4 + i * ((280 - 8) / Math.max(1, labels.length - 1))) / 280) * 100;
          return (
            <div
              key={i}
              className="absolute top-0 flex flex-col items-center leading-none -translate-x-1/2"
              style={{ left: `${pct}%` }}
            >
              <span className="text-[9px] font-semibold text-foreground uppercase tracking-tight">{l.wd}</span>
              <span className="text-[8px] text-muted-foreground">{l.dm}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
