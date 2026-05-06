import { apiClient } from '@/lib/api.client';

// ─── Raw shapes returned by the backend ──────────────────────────────────────

interface RawKpiCards {
  totalDocuments: number;
  totalDocumentsTrend: string;       // "+12.0%" or "-5.3%"
  pendingValidations: number;
  activeUsers: number;
  storageUsedGB: number;
  storageCapacityGB: number;
  approvedThisMonth: number;
}

interface RawDailyActivity {
  date: string;  // ISO 8601 date string from backend
  uploads: number;
  approvals: number;
}

interface RawDepartmentDelay {
  departmentName: string;
  averageDelayHours: number;
}

interface RawDepartmentUsage {
  departmentName: string;
  percentage: number;
}

interface RawDashboardData {
  kpiCards: RawKpiCards;
  dailyActivity: RawDailyActivity[];
  departmentDelays: RawDepartmentDelay[];
  departmentUsage: RawDepartmentUsage[];
}

// ─── Frontend-shaped types (what charts actually consume) ─────────────────────

export interface KpiData {
  totalDocuments: string;       // "1 284"
  totalDocumentsTrend: string;  // "+12.0%"
  trendPositive: boolean;       // true when trend starts with '+'
  pendingValidations: number;
  activeUsers: number;
  storageUsedGB: number;
  storageCapacityGB: number;
  storagePct: number;           // (storageUsedGB / storageCapacityGB) * 100
  approvedThisMonth: number;
}

/** Matches the shape recharts AreaChart `data` prop expects */
export interface DailyActivityPoint {
  date: string;     // "05 mai" — fr-FR formatted
  uploads: number;
  approvals: number;
}

/** Matches the shape recharts BarChart `data` prop expects */
export interface DepartmentDelay {
  dept: string;
  hours: number;
}

/** Matches the shape recharts PieChart `data` prop expects */
export interface DepartmentUsage {
  name: string;
  value: number;   // integer percentage, e.g. 34
  color: string;   // assigned from palette
}

export interface DashboardData {
  kpi: KpiData;
  dailyActivity: DailyActivityPoint[];
  departmentDelays: DepartmentDelay[];
  departmentUsage: DepartmentUsage[];
}

// ─── Color palette for donut slices (cycles if > 5 departments) ───────────────

const DONUT_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

// ─── Transform backend → frontend shapes ────────────────────────────────────

function toFrDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatCount(value: number): string {
  // French number formatting: 1284 → "1 284"
  return value.toLocaleString('fr-FR');
}

function transform(raw: RawDashboardData): DashboardData {
  const { kpiCards, dailyActivity, departmentDelays, departmentUsage } = raw;

  const storagePct = kpiCards.storageCapacityGB > 0
    ? Math.round((kpiCards.storageUsedGB / kpiCards.storageCapacityGB) * 1000) / 10
    : 0;

  return {
    kpi: {
      totalDocuments: formatCount(kpiCards.totalDocuments),
      totalDocumentsTrend: kpiCards.totalDocumentsTrend,
      trendPositive: kpiCards.totalDocumentsTrend.startsWith('+'),
      pendingValidations: kpiCards.pendingValidations,
      activeUsers: kpiCards.activeUsers,
      storageUsedGB: kpiCards.storageUsedGB,
      storageCapacityGB: kpiCards.storageCapacityGB,
      storagePct,
      approvedThisMonth: kpiCards.approvedThisMonth,
    },
    dailyActivity: dailyActivity.map((d) => ({
      date: toFrDate(d.date),
      uploads: d.uploads,
      approvals: d.approvals,
    })),
    departmentDelays: departmentDelays.map((d) => ({
      dept: d.departmentName,
      hours: d.averageDelayHours,
    })),
    departmentUsage: departmentUsage.map((d, i) => ({
      name: d.departmentName,
      value: Math.round(d.percentage),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    })),
  };
}

// ─── API call ────────────────────────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardData> {
  const { data } = await apiClient.get<RawDashboardData>('/app/dashboard/dashboard-data');
  return transform(data);
}
