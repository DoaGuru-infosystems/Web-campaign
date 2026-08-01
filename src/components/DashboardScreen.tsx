import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Dimensions, TextInput,
} from 'react-native';
import Svg, { Rect, Polyline, Circle, G, Path, Text as SvgText, Line } from 'react-native-svg';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';

const { width: W } = Dimensions.get('window');
const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#e11d48'];

export interface DashboardScreenProps {
  serverUrl: string;
  token?: string;
  handleLogout: () => void;
  onNavigate: (screen: string) => void;
  onSelectCampaign?: (c: any) => void;
  onOpenMenu?: () => void;
  user?: any;
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────
const BarChart = ({ data }: { data: { campaign_title: string; value: number }[] }) => {
  const cW = W - 64;
  const cH = 200;
  const padL = 28, padB = 40, padT = 10, padR = 8;
  const chartW = cW - padL - padR;
  const chartH = cH - padT - padB;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.min(28, (chartW / data.length) * 0.6);

  return (
    <Svg width={cW} height={cH}>
      {/* Y axis labels */}
      {[0, Math.round(max / 2), max].map((v, i) => {
        const y = padT + chartH - (v / max) * chartH;
        return (
          <G key={i}>
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{v}</SvgText>
            <Line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#f1f5f9" strokeWidth={1} />
          </G>
        );
      })}
      {data.map((d, i) => {
        const x = padL + (i / data.length) * chartW + (chartW / data.length - barW) / 2;
        const barH = (d.value / max) * chartH;
        const y = padT + chartH - barH;
        const label = d.campaign_title.length > 8 ? d.campaign_title.slice(0, 8) + '…' : d.campaign_title;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} rx={4} fill="#6366f1" />
            <SvgText x={x + barW / 2} y={padT + chartH + 12} fontSize={8} fill="#94a3b8" textAnchor="middle">{label}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

// ── Mini Line Chart ────────────────────────────────────────────────────────
const LineChartView = ({ data, color = '#10b981', xKey = 'date', yKey = 'count' }:
  { data: any[]; color?: string; xKey?: string; yKey?: string }) => {
  const cW = W - 64;
  const cH = 200;
  const padL = 28, padB = 30, padT = 10, padR = 8;
  const chartW = cW - padL - padR;
  const chartH = cH - padT - padB;
  const max = Math.max(...data.map((d: any) => d[yKey]), 1);

  const pts = data.map((d: any, i: number) => ({
    x: padL + (i / (data.length - 1 || 1)) * chartW,
    y: padT + chartH - (d[yKey] / max) * chartH,
    label: String(d[xKey]).slice(-5),
    val: d[yKey],
  }));

  const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={cW} height={cH}>
      {[0, Math.round(max / 2), max].map((v, i) => {
        const y = padT + chartH - (v / max) * chartH;
        return (
          <G key={i}>
            <SvgText x={padL - 4} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{v}</SvgText>
            <Line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#f1f5f9" strokeWidth={1} />
          </G>
        );
      })}
      <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={4} fill={color} />
          <SvgText x={p.x} y={cH - 10} fontSize={8} fill="#94a3b8" textAnchor="middle">{p.label}</SvgText>
        </G>
      ))}
    </Svg>
  );
};

// ── Donut Chart ────────────────────────────────────────────────────────────
const DonutChart = ({ data }: { data: { name: string; value: number }[] }) => {
  const size = 160;
  const cx = size / 2, cy = size / 2;
  const R = 60, r = 38;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let startAngle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const xi1 = cx + r * Math.cos(startAngle);
    const yi1 = cy + r * Math.sin(startAngle);
    const xi2 = cx + r * Math.cos(endAngle);
    const yi2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${xi2},${yi2} A${r},${r},0,${large},0,${xi1},${yi1} Z`;
    startAngle = endAngle;
    return { path, color: COLORS[i % COLORS.length], name: d.name, value: d.value };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {slices.map((s, i) => <Path key={i} d={s.path} fill={s.color} />)}
      </Svg>
      <View style={{ marginTop: 12, gap: 6, width: W - 80 }}>
        {slices.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ fontSize: 12, color: '#475569', flex: 1 }}>{s.name}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>({s.value})</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  serverUrl, token, handleLogout, onNavigate, onOpenMenu, user,
}) => {
  const [dashData, setDashData] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [d, c] = await Promise.all([
        API_CALLS.get('/analytics/dashboard', serverUrl, token),
        API_CALLS.get('/analytics/charts', serverUrl, token),
      ]);
      setDashData(d); setCharts(c);
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = dashData?.stats || {};
  const recentCampaigns = dashData?.recent_campaigns || [];
  const recentParticipants = dashData?.recent_participants || [];

  const STAT_CARDS = [
    { label: 'Total Campaigns', value: stats.total_campaigns || 0, icon: 'megaphone', bg: '#eef2ff', ic: '#6366f1' },
    { label: 'Active Campaigns', value: stats.active_campaigns || 0, icon: 'clock', bg: '#ecfdf5', ic: '#10b981' },
    { label: 'Total Registrations', value: stats.total_registrations || 0, icon: 'users', bg: '#f5f3ff', ic: '#7c3aed' },
    { label: 'Registrations Today', value: stats.registrations_today || 0, icon: 'calendar', bg: '#fdf4ff', ic: '#a855f7' },
  ];

  const statusColor = (s: string) =>
    s === 'Published' ? { bg: '#f0fdf4', text: '#16a34a' } :
    s === 'Closed' ? { bg: '#fef2f2', text: '#dc2626' } :
    { bg: '#f8fafc', text: '#475569' };

  const partStatusColor = (s: string) =>
    s === 'Approved' || s === 'Verified' ? { bg: '#f0fdf4', text: '#16a34a' } :
    s === 'Rejected' ? { bg: '#fef2f2', text: '#dc2626' } :
    { bg: '#fffbeb', text: '#d97706' };

  return (
    <View style={s.root}>
      {/* ── Top App Bar ── */}
      <View style={s.appBar}>
        <TouchableOpacity onPress={onOpenMenu} style={s.iconBtn}>
          <SvgIcon type="menu" color="#1e293b" size={22} />
        </TouchableOpacity>
        <View style={s.searchBarWrap}>
          <SvgIcon type="search" color="#94a3b8" size={14} />
          <Text style={s.searchBarPH}>Global search: campaigns, participants...</Text>
        </View>
        <View style={s.bellWrap}>
          <Text style={s.bellIcon}>🔔</Text>
          <View style={s.bellDot} />
        </View>
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={s.loadingTxt}>Loading dashboard intelligence...</Text>
        </View>
      ) : error ? (
        <View style={s.centerBox}>
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryTxt}>Retry Connection</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero Header ── */}
          <View style={s.hero}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>System Analytics</Text>
              <Text style={s.heroSub}>Real-time overview of campaign performance and audience registrations</Text>
            </View>
            {user?.role === 'Admin' && (
              <TouchableOpacity style={s.newBtn} onPress={() => { onNavigate('CREATE_CAMPAIGN'); }}>
                <Text style={s.newBtnTxt}>+  New Campaign</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Stat Cards ── */}
          <View style={s.statsGrid}>
            {STAT_CARDS.map((card, i) => (
              <View key={i} style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: card.bg }]}>
                  <SvgIcon type={card.icon as any} color={card.ic} size={22} />
                </View>
                <View>
                  <Text style={s.statLabel}>{card.label}</Text>
                  <Text style={s.statValue}>{card.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Bar Chart ── */}
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={s.chartTrendIcon}>↗</Text>
              <Text style={s.chartTitle}>Campaign-wise Registrations</Text>
            </View>
            {charts?.campaign_wise?.length > 0 ? (
              <BarChart data={charts.campaign_wise} />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No campaign registrations recorded yet</Text>
              </View>
            )}
          </View>

          {/* ── Daily Line Chart ── */}
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={[s.chartTrendIcon, { color: '#10b981' }]}>↗</Text>
              <Text style={s.chartTitle}>Daily Registration Trends (Last 14 Days)</Text>
            </View>
            {charts?.daily?.length > 0 ? (
              <LineChartView data={charts.daily} color="#10b981" xKey="date" yKey="count" />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No registrations in the last 14 days</Text>
              </View>
            )}
          </View>

          {/* ── Monthly Growth ── */}
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={[s.chartTrendIcon, { color: '#6366f1' }]}>↗</Text>
              <Text style={s.chartTitle}>Monthly Growth Curve</Text>
            </View>
            {charts?.monthly?.length > 0 ? (
              <LineChartView data={charts.monthly} color="#6366f1" xKey="month" yKey="count" />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No growth statistics to display</Text>
              </View>
            )}
          </View>

          {/* ── Donut / Category Chart ── */}
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={[s.chartTrendIcon, { color: '#a855f7' }]}>↗</Text>
              <Text style={s.chartTitle}>Category Performance</Text>
            </View>
            {charts?.category_wise?.length > 0 ? (
              <DonutChart data={charts.category_wise} />
            ) : (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No campaigns categorized yet</Text>
              </View>
            )}
          </View>

          {/* ── Recent Campaigns Table ── */}
          <View style={s.tableCard}>
            <View style={s.tableHeader}>
              <Text style={s.tableTitle}>Recent Campaigns</Text>
              <TouchableOpacity onPress={() => onNavigate('CAMPAIGNS')} style={s.viewAllBtn}>
                <Text style={s.viewAllTxt}>View all →</Text>
              </TouchableOpacity>
            </View>
            {recentCampaigns.length === 0 ? (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No campaigns created yet.</Text>
              </View>
            ) : (
              <View>
                <View style={s.tableHead}>
                  {['CAMPAIGN TITLE', 'CATEGORY', 'STATUS', 'REGS'].map(h => (
                    <Text key={h} style={[s.tableHeadCell, h === 'CAMPAIGN TITLE' && { flex: 2 }]}>{h}</Text>
                  ))}
                </View>
                {recentCampaigns.map((c: any) => {
                  const sc = statusColor(c.status);
                  return (
                    <View key={c.id} style={s.tableRow}>
                      <Text style={[s.tableCellTitle, { flex: 2 }]} numberOfLines={1}>{c.title}</Text>
                      <Text style={s.tableCell}>{c.category}</Text>
                      <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusPillTxt, { color: sc.text }]}>{c.status}</Text>
                      </View>
                      <Text style={s.tableCellNum}>{c.registrations_count || 0}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Recent Participant Actions ── */}
          <View style={[s.tableCard, { marginBottom: 32 }]}>
            <Text style={s.tableTitle}>Recent Participant Actions</Text>
            {recentParticipants.length === 0 ? (
              <View style={s.emptyChart}>
                <Text style={s.emptyChartIcon}>📭</Text>
                <Text style={s.emptyChartTxt}>No submissions recorded yet</Text>
              </View>
            ) : (
              <View style={{ gap: 8, marginTop: 12 }}>
                {recentParticipants.map((p: any) => {
                  const psc = partStatusColor(p.status);
                  const time = new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={p.id} style={s.partRow}>
                      <View style={s.partAvatar}>
                        <SvgIcon type="user" color="#7c3aed" size={18} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.partTopRow}>
                          <Text style={s.partName} numberOfLines={1}>{p.name || 'Participant'}</Text>
                          <Text style={s.partTime}>{time}</Text>
                        </View>
                        <Text style={s.partCamp} numberOfLines={1}>
                          Registered for: <Text style={{ fontWeight: '700', color: '#475569' }}>{p.campaign_title}</Text>
                        </Text>
                        <View style={s.partBottomRow}>
                          <Text style={s.partRegId}>{p.registration_id}</Text>
                          <View style={[s.statusPill, { backgroundColor: psc.bg }]}>
                            <Text style={[s.statusPillTxt, { color: psc.text }]}>{p.status}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', gap: 8 },
  iconBtn: { padding: 6 },
  searchBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  searchBarPH: { fontSize: 12, color: '#94a3b8' },
  bellWrap: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 20 },
  bellDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#fff' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  loadingTxt: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  errorTxt: { fontSize: 13, color: '#ef4444', fontWeight: '600', textAlign: 'center' },
  retryBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { padding: 16, gap: 16 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  heroSub: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 18 },
  newBtn: { backgroundColor: '#7c3aed', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', flexShrink: 0 },
  newBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, width: (W - 42) / 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: '900', color: '#1e293b', lineHeight: 34 },
  chartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  chartTrendIcon: { fontSize: 16, color: '#7c3aed', fontWeight: '900' },
  chartTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', flex: 1 },
  emptyChart: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyChartIcon: { fontSize: 28 },
  emptyChartTxt: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  tableCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tableTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  viewAllBtn: {},
  viewAllTxt: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  tableHead: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 4 },
  tableHeadCell: { flex: 1, fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 4 },
  tableCellTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: '#334155' },
  tableCell: { flex: 1, fontSize: 11, color: '#475569', fontWeight: '500' },
  tableCellNum: { flex: 1, fontSize: 13, fontWeight: '800', color: '#334155', textAlign: 'center' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusPillTxt: { fontSize: 10, fontWeight: '700' },
  partRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 10, backgroundColor: '#fafafa', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  partAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  partTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partName: { fontSize: 12, fontWeight: '800', color: '#1e293b', flex: 1 },
  partTime: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
  partCamp: { fontSize: 10, color: '#64748b', marginTop: 2 },
  partBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  partRegId: { fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', fontWeight: '600' },
});
