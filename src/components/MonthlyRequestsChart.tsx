import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ServiceRequest } from '../types/tu';

interface MonthlyRequestsChartProps {
  requests: ServiceRequest[];
}

interface MonthlyDatum {
  monthKey: string;
  label: string;
  fullLabel: string;
  masuk: number;
  selesai: number;
}

const BULAN_SINGKAT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const BULAN_PANJANG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function buildMonthlySeries(requests: ServiceRequest[]): MonthlyDatum[] {
  const countsByMonth = new Map<string, { masuk: number; selesai: number }>();
  let latestTimestamp = Date.now();

  for (const req of requests) {
    const dt = new Date(req.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    if (dt.getTime() > latestTimestamp) {
      latestTimestamp = dt.getTime();
    }
    const year = dt.getFullYear();
    const month = dt.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const existing = countsByMonth.get(key) ?? { masuk: 0, selesai: 0 };
    existing.masuk += 1;
    if (req.status === 'Siap Diambil' || req.status === 'Selesai') {
      existing.selesai += 1;
    }
    countsByMonth.set(key, existing);
  }

  const anchor = new Date(latestTimestamp);
  const series: MonthlyDatum[] = [];

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const stats = countsByMonth.get(key) ?? { masuk: 0, selesai: 0 };
    series.push({
      monthKey: key,
      label: `${BULAN_SINGKAT[month]} ${String(year).slice(-2)}`,
      fullLabel: `${BULAN_PANJANG[month]} ${year}`,
      masuk: stats.masuk,
      selesai: stats.selesai,
    });
  }

  return series;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: MonthlyDatum }>;
}

function MonthlyTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm">
      <p className="font-semibold text-slate-900">{datum.fullLabel}</p>
      <div className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Permohonan Masuk</span>
          <span className="font-mono font-semibold tabular-nums text-blue-700">
            {datum.masuk} surat
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Siap / Selesai</span>
          <span className="font-mono font-semibold tabular-nums text-emerald-700">
            {datum.selesai} surat
          </span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyRequestsChart({ requests }: MonthlyRequestsChartProps) {
  const data = useMemo(() => buildMonthlySeries(requests), [requests]);
  const sixMonthTotal = useMemo(
    () => data.reduce((sum, item) => sum + item.masuk, 0),
    [data]
  );
  const currentMonth = data[data.length - 1];

  return (
    <section
      aria-label="Grafik Bulanan Permohonan Surat Masuk"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Tren Bulanan Permohonan Surat Masuk
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Rekapitulasi jumlah pengajuan administrasi per bulan selama 6 bulan terakhir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
          <div>
            <span>6 Bulan Terakhir: </span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {sixMonthTotal} surat
            </span>
          </div>
          {currentMonth && (
            <div>
              <span>{currentMonth.fullLabel}: </span>
              <span className="font-mono font-semibold tabular-nums text-blue-700">
                {currentMonth.masuk} masuk
              </span>
            </div>
          )}
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-center text-sm text-slate-500">
          Belum ada permohonan surat yang tercatat untuk ditampilkan pada grafik.
        </div>
      ) : (
        <div className="mt-4 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={6}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                content={<MonthlyTooltip />}
              />
              <Bar
                dataKey="masuk"
                name="Permohonan Masuk"
                fill="#1d4ed8"
                radius={[6, 6, 0, 0]}
                maxBarSize={44}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
