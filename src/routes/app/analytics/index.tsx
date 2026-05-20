import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  parseISO,
} from 'date-fns'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/time'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { AppointmentStatus } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawAppointment {
  status: AppointmentStatus
  price_charged: number | null
  start_time: string
  created_at: string
}

interface RawClient {
  id: string
  created_at: string
}

interface RawBarberAppointment {
  barber_id: string
  status: AppointmentStatus
  price_charged: number | null
  barbers: {
    name: string
    color: string
  } | null
}

interface RawServiceAppointment {
  service_id: string
  services: {
    name: string
    color: string
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
  no_show: '#f97316',
  pending: '#a855f7',
  checked_in: '#06b6d4',
  in_progress: '#eab308',
  rescheduled: '#6b7280',
}

// Hourly heatmap: 8am to 9pm inclusive
const HEATMAP_HOURS = Array.from({ length: 14 }, (_, i) => i + 8)

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchLast30DaysAppointments(): Promise<RawAppointment[]> {
  const start = startOfDay(subDays(new Date(), 29)).toISOString()
  const end = endOfDay(new Date()).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select('status, price_charged, created_at, start_time')
    .gte('start_time', start)
    .lte('start_time', end)

  if (error) throw error
  return (data ?? []) as RawAppointment[]
}

async function fetchClientsThisMonth(): Promise<RawClient[]> {
  const start = startOfMonth(new Date()).toISOString()
  const end = endOfMonth(new Date()).toISOString()

  const { data, error } = await supabase
    .from('clients')
    .select('id, created_at')
    .gte('created_at', start)
    .lte('created_at', end)

  if (error) throw error
  return (data ?? []) as RawClient[]
}

async function fetchBarberRevenueAppointments(): Promise<RawBarberAppointment[]> {
  const start = startOfDay(subDays(new Date(), 29)).toISOString()
  const end = endOfDay(new Date()).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select('barber_id, status, price_charged, barbers(name, color)')
    .eq('status', 'completed')
    .gte('start_time', start)
    .lte('start_time', end)

  if (error) throw error
  // Supabase types nested joins as arrays; the row shape is known here.
  return (data ?? []) as unknown as RawBarberAppointment[]
}

async function fetchServiceAppointments(): Promise<RawServiceAppointment[]> {
  const now = new Date()
  const start = startOfMonth(now).toISOString()
  const end = endOfMonth(now).toISOString()

  const { data, error } = await supabase
    .from('appointments')
    .select('service_id, services(name, color)')
    .gte('start_time', start)
    .lte('start_time', end)

  if (error) throw error
  // Supabase types nested joins as arrays; the row shape is known here.
  return (data ?? []) as unknown as RawServiceAppointment[]
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <Card className="p-5">
      <div className="h-3 w-28 rounded bg-[var(--color-bg-subtle)] animate-pulse mb-3" />
      <div className="h-8 w-24 rounded bg-[var(--color-bg-subtle)] animate-pulse mb-2" />
      <div className="h-3 w-20 rounded bg-[var(--color-bg-subtle)] animate-pulse" />
    </Card>
  )
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-[var(--radius-lg)] bg-[var(--color-bg-subtle)] animate-pulse"
      style={{ height }}
    />
  )
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

interface KPIData {
  totalThisMonth: number
  revenueThisMonth: number
  noShowRate: number
  newClientsThisMonth: number
  avgTicket: number
  completionRate: number
}

function KPICard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card className="p-5">
      <p className="text-xs text-[var(--color-fg-muted)] font-medium mb-2">{label}</p>
      <p
        className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">{sub}</p>}
    </Card>
  )
}

function KPIStrip({ data }: { data: KPIData }) {
  const { t } = useTranslation('dashboard')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label={t('kpi_appts_month')}
          value={data.totalThisMonth.toString()}
          sub={t('kpi_appts_sub')}
        />
        <KPICard
          label={t('kpi_revenue_month')}
          value={formatPrice(data.revenueThisMonth)}
          sub={t('kpi_revenue_sub')}
        />
        <KPICard
          label={t('kpi_noshow_rate')}
          value={`${data.noShowRate.toFixed(0)}%`}
          sub={t('kpi_noshow_sub')}
        />
        <KPICard
          label={t('kpi_new_clients')}
          value={data.newClientsThisMonth.toString()}
          sub={t('kpi_new_clients_sub')}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard
          label={t('kpi_avg_ticket')}
          value={formatPrice(data.avgTicket)}
          sub={t('kpi_avg_ticket_sub')}
        />
        <KPICard
          label={t('kpi_completion_rate')}
          value={`${data.completionRate.toFixed(0)}%`}
          sub={t('kpi_completion_rate_sub')}
        />
      </div>
    </div>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number
  name?: string
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  formatter?: (v: number, name?: string) => string
  multiLine?: boolean
}

function CustomTooltip({ active, payload, label, formatter, multiLine }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  if (multiLine) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 shadow-[var(--shadow-md)]">
        <p className="text-xs text-[var(--color-fg-muted)] mb-2">{label}</p>
        {payload.map((item, idx) => (
          <p
            key={idx}
            className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-2"
          >
            {item.color && (
              <span
                className="inline-block size-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span>
              {item.name && (
                <span className="text-[var(--color-fg-muted)] font-normal mr-1">{item.name}:</span>
              )}
              {formatter ? formatter(item.value, item.name) : item.value}
            </span>
          </p>
        ))}
      </div>
    )
  }

  const val = payload[0].value
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="text-xs text-[var(--color-fg-muted)] mb-1">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-fg)]">
        {formatter ? formatter(val) : val}
      </p>
    </div>
  )
}

// ── Derived data types ─────────────────────────────────────────────────────────

interface BarberChartRow {
  name: string
  color: string
  revenue: number
  appointments: number
}

interface ServiceChartRow {
  name: string
  color: string
  bookings: number
}

interface HourlyChartRow {
  hour: string
  bookings: number
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t } = useTranslation(['dashboard', 'common'])

  const { data: appointments, isLoading: apptLoading } = useQuery({
    queryKey: ['analytics', 'appointments', 'last30'],
    queryFn: fetchLast30DaysAppointments,
  })

  const { data: newClients, isLoading: clientsLoading } = useQuery({
    queryKey: ['analytics', 'clients', 'thisMonth'],
    queryFn: fetchClientsThisMonth,
  })

  const { data: barberAppts, isLoading: barberLoading } = useQuery({
    queryKey: ['analytics', 'barber-revenue', 'last30'],
    queryFn: fetchBarberRevenueAppointments,
  })

  const { data: serviceAppts, isLoading: serviceLoading } = useQuery({
    queryKey: ['analytics', 'services', 'thisMonth'],
    queryFn: fetchServiceAppointments,
  })

  const isLoading = apptLoading || clientsLoading
  const isBarberLoading = barberLoading
  const isServiceLoading = serviceLoading

  // Status labels using i18n common keys
  const STATUS_LABELS: Record<string, string> = {
    confirmed: t('common:status.confirmed'),
    completed: t('common:status.completed'),
    cancelled: t('common:status.cancelled'),
    no_show: t('common:status.no_show'),
    pending: t('common:status.pending'),
    checked_in: t('common:status.checked_in'),
    in_progress: t('common:status.in_progress'),
    rescheduled: t('common:status.rescheduled'),
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const kpiData = useMemo<KPIData>(() => {
    const appts = appointments ?? []
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const thisMonthAppts = appts.filter((a) => {
      const d = parseISO(a.start_time)
      return d >= monthStart && d <= monthEnd
    })

    const totalThisMonth = thisMonthAppts.length

    const completedThisMonth = thisMonthAppts.filter((a) => a.status === 'completed')
    const revenueThisMonth = completedThisMonth.reduce(
      (sum, a) => sum + Number(a.price_charged ?? 0),
      0,
    )

    // No-show rate over last 30 days (all data fetched)
    const total30 = appts.length
    const noShows30 = appts.filter((a) => a.status === 'no_show').length
    const noShowRate = total30 > 0 ? (noShows30 / total30) * 100 : 0

    // Avg ticket: revenue / completed appointments this month
    const completedCount = completedThisMonth.length
    const avgTicket = completedCount > 0 ? revenueThisMonth / completedCount : 0

    // Completion rate: completed / (completed + no_show + cancelled)
    const terminal = thisMonthAppts.filter(
      (a) => a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled',
    )
    const completionRate =
      terminal.length > 0 ? (completedCount / terminal.length) * 100 : 0

    return {
      totalThisMonth,
      revenueThisMonth,
      noShowRate,
      newClientsThisMonth: (newClients ?? []).length,
      avgTicket,
      completionRate,
    }
  }, [appointments, newClients])

  // ── Bookings by day (last 30) ─────────────────────────────────────────────

  const bookingsByDay = useMemo(() => {
    const appts = appointments ?? []
    const today = new Date()
    const days = eachDayOfInterval({ start: subDays(today, 29), end: today })

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const count = appts.filter(
        (a) => format(parseISO(a.start_time), 'yyyy-MM-dd') === key,
      ).length
      return { date: format(day, 'MMM d'), count }
    })
  }, [appointments])

  // ── Revenue trend (last 30) ───────────────────────────────────────────────

  const revenueTrend = useMemo(() => {
    const appts = appointments ?? []
    const today = new Date()
    const days = eachDayOfInterval({ start: subDays(today, 29), end: today })

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const revenue = appts
        .filter(
          (a) =>
            a.status === 'completed' &&
            format(parseISO(a.start_time), 'yyyy-MM-dd') === key,
        )
        .reduce((sum, a) => sum + Number(a.price_charged ?? 0), 0)
      return { date: format(day, 'MMM d'), revenue }
    })
  }, [appointments])

  // ── Status breakdown (this month) ────────────────────────────────────────

  const statusBreakdown = useMemo(() => {
    const appts = appointments ?? []
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const thisMonthAppts = appts.filter((a) => {
      const d = parseISO(a.start_time)
      return d >= monthStart && d <= monthEnd
    })

    const counts: Record<string, number> = {}
    for (const a of thisMonthAppts) {
      counts[a.status] = (counts[a.status] ?? 0) + 1
    }

    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)
  }, [appointments])

  const total = statusBreakdown.reduce((s, d) => s + d.count, 0)

  // ── Revenue & Appointments by Barber (last 30, completed) ────────────────

  const barberChartData = useMemo<BarberChartRow[]>(() => {
    const appts = barberAppts ?? []

    const map = new Map<string, BarberChartRow>()

    for (const a of appts) {
      const barberName = a.barbers?.name ?? a.barber_id
      const barberColor = a.barbers?.color ?? 'var(--color-primary)'

      if (!map.has(barberName)) {
        map.set(barberName, {
          name: barberName,
          color: barberColor,
          revenue: 0,
          appointments: 0,
        })
      }

      const row = map.get(barberName)!
      row.revenue += Number(a.price_charged ?? 0)
      row.appointments += 1
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [barberAppts])

  // ── Top Services (this month) ─────────────────────────────────────────────

  const serviceChartData = useMemo<ServiceChartRow[]>(() => {
    const appts = serviceAppts ?? []

    const map = new Map<string, ServiceChartRow>()

    for (const a of appts) {
      const serviceName = a.services?.name ?? a.service_id
      const serviceColor = a.services?.color ?? 'var(--color-primary)'

      if (!map.has(serviceName)) {
        map.set(serviceName, {
          name: serviceName,
          color: serviceColor,
          bookings: 0,
        })
      }

      map.get(serviceName)!.bookings += 1
    }

    return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings)
  }, [serviceAppts])

  // ── Hourly Heatmap (last 30 days, from existing appointments) ─────────────

  const hourlyChartData = useMemo<HourlyChartRow[]>(() => {
    const appts = appointments ?? []

    const counts: Record<number, number> = {}
    for (const h of HEATMAP_HOURS) {
      counts[h] = 0
    }

    for (const a of appts) {
      const hour = parseISO(a.start_time).getHours()
      if (hour >= HEATMAP_HOURS[0] && hour <= HEATMAP_HOURS[HEATMAP_HOURS.length - 1]) {
        counts[hour] = (counts[hour] ?? 0) + 1
      }
    }

    return HEATMAP_HOURS.map((h) => ({
      hour: `${h}:00`,
      bookings: counts[h] ?? 0,
    }))
  }, [appointments])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageShell title={t('analytics_title')}>
      <div className="space-y-6">
        {/* KPI Strip */}
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <KPISkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1].map((i) => (
                <KPISkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <KPIStrip data={kpiData} />
        )}

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bookings by Day */}
          <Card>
            <CardHeader>
              <CardTitle>{t('chart_bookings_day')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bookingsByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) =>
                            v === 1
                              ? t('bookings_label', { count: v })
                              : t('bookings_label_plural', { count: v })
                          }
                        />
                      }
                      cursor={{ fill: 'var(--color-bg-subtle)' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-primary)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>{t('chart_revenue_trend')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      content={<CustomTooltip formatter={(v) => formatPrice(v)} />}
                      cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{t('chart_status_breakdown')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : statusBreakdown.length === 0 ? (
              <p className="text-sm text-[var(--color-fg-muted)] py-10 text-center">
                {t('chart_no_appts')}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Pie */}
                <div className="shrink-0">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {statusBreakdown.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] ?? '#6b7280'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => {
                          const v = Number(value)
                          const n = String(name)
                          return [
                            `${v} (${total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)`,
                            STATUS_LABELS[n] ?? n,
                          ]
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  {statusBreakdown.map(({ status, count }) => {
                    const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0'
                    const color = STATUS_COLORS[status] ?? '#6b7280'
                    const label = STATUS_LABELS[status] ?? status
                    return (
                      <div
                        key={status}
                        className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2.5"
                      >
                        <span
                          className="shrink-0 size-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex-1 text-sm text-[var(--color-fg)]">{label}</span>
                        <span
                          className="text-sm font-semibold text-[var(--color-fg)] tabular-nums"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {count}
                        </span>
                        <span className="text-xs text-[var(--color-fg-muted)] tabular-nums w-8 text-right">
                          {pct}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts row 2: Barber Revenue + Top Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 4: Revenue & Appointments by Barber */}
          <Card>
            <CardHeader>
              <CardTitle>{t('chart_barber_revenue')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isBarberLoading ? (
                <ChartSkeleton height={240} />
              ) : barberChartData.length === 0 ? (
                <p className="text-sm text-[var(--color-fg-muted)] py-10 text-center">
                  {t('chart_no_data')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, barberChartData.length * 52)}>
                  <BarChart
                    layout="vertical"
                    data={barberChartData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => formatPrice(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--color-fg)' }}
                      tickLine={false}
                      axisLine={false}
                      width={90}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          multiLine
                          formatter={(v, name) =>
                            name === t('chart_barber_revenue_label')
                              ? formatPrice(v)
                              : v.toString()
                          }
                        />
                      }
                      cursor={{ fill: 'var(--color-bg-subtle)' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: 'var(--color-fg-muted)' }}
                    />
                    <Bar
                      dataKey="revenue"
                      name={t('chart_barber_revenue_label')}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={20}
                    >
                      {barberChartData.map((entry, index) => (
                        <Cell
                          key={`barber-rev-${index}`}
                          fill={entry.color ?? 'var(--color-primary)'}
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="appointments"
                      name={t('chart_barber_appts_label')}
                      fill="var(--color-bg-subtle)"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Chart 5: Top Services */}
          <Card>
            <CardHeader>
              <CardTitle>{t('chart_top_services')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {isServiceLoading ? (
                <ChartSkeleton height={240} />
              ) : serviceChartData.length === 0 ? (
                <p className="text-sm text-[var(--color-fg-muted)] py-10 text-center">
                  {t('chart_no_data')}
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, serviceChartData.length * 52)}>
                  <BarChart
                    layout="vertical"
                    data={serviceChartData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--color-fg)' }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <Tooltip
                      content={
                        <CustomTooltip
                          formatter={(v) =>
                            v === 1
                              ? t('bookings_label', { count: v })
                              : t('bookings_label_plural', { count: v })
                          }
                        />
                      }
                      cursor={{ fill: 'var(--color-bg-subtle)' }}
                    />
                    <Bar
                      dataKey="bookings"
                      name={t('chart_top_services_label')}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={20}
                    >
                      {serviceChartData.map((entry, index) => (
                        <Cell
                          key={`svc-${index}`}
                          fill={entry.color ?? 'var(--color-primary)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart 6: Hourly Heatmap — full width */}
        <Card>
          <CardHeader>
            <CardTitle>{t('chart_hourly_heatmap')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : hourlyChartData.every((d) => d.bookings === 0) ? (
              <p className="text-sm text-[var(--color-fg-muted)] py-10 text-center">
                {t('chart_no_data')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={hourlyChartData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={(v) =>
                          v === 1
                            ? t('bookings_label', { count: v })
                            : t('bookings_label_plural', { count: v })
                        }
                      />
                    }
                    cursor={{ fill: 'var(--color-bg-subtle)' }}
                  />
                  <Bar
                    dataKey="bookings"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={32}
                  >
                    {hourlyChartData.map((entry, index) => {
                      // Intensity: darker fill for busier hours
                      const max = Math.max(...hourlyChartData.map((d) => d.bookings), 1)
                      const intensity = entry.bookings / max
                      // Interpolate opacity 0.25 → 1.0
                      const opacity = 0.25 + intensity * 0.75
                      return (
                        <Cell
                          key={`hour-${index}`}
                          fill="var(--color-primary)"
                          fillOpacity={opacity}
                        />
                      )
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
