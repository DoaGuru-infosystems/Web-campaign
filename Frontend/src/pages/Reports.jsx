import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download, Loader2, BarChart3, ShieldCheck,
  FileSpreadsheet, Users, TrendingUp, Calendar,
  ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronRight, Megaphone, FileDown, Activity
} from 'lucide-react';
import api from '../utils/api';

const StatusBadge = ({ status }) => {
  const map = {
    Published: { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
    Draft:     { cls: 'bg-amber-50 text-amber-600 border-amber-200',       icon: <Clock className="h-2.5 w-2.5" /> },
    Closed:    { cls: 'bg-rose-50 text-rose-500 border-rose-200',           icon: <XCircle className="h-2.5 w-2.5" /> },
  };
  const s = map[status] || { cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: <AlertCircle className="h-2.5 w-2.5" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${s.cls}`}>
      {s.icon}
      {status}
    </span>
  );
};

const Reports = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await api.get('/campaigns');
        setCampaigns(res.campaigns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const totalParticipants = campaigns.reduce((s, c) => s + (c.total_registrations || 0), 0);
  const publishedCount   = campaigns.filter(c => c.status === 'Published').length;
  const closedCount      = campaigns.filter(c => c.status === 'Closed').length;

  const filtered = campaigns.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  /* Direct CSV export — re-uses same logic as CampaignDetails but from the Reports page */
  const handleExportCSV = async (camp) => {
    setExportingId(camp.id);
    try {
      const token = api.getToken();
      const response = await fetch(
        `${api.BACKEND_URL}/api/registrations/export/${camp.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        alert(e.error || 'Export failed.');
        return;
      }
      const data = await response.json();
      if (!data || data.length === 0) {
        alert('No submissions to export for this campaign.');
        return;
      }

      // Fetch field schema
      const schemaRes = await api.get(`/campaigns/${camp.id}`);
      const fields = schemaRes.fields || [];

      const headers = ['Registration ID', 'Date', 'Status', ...fields.map(f => `"${f.label}"`)];
      const rows = data.map(r => {
        const base = [
          `"${r.registration_id}"`,
          `"${new Date(r.created_at).toLocaleDateString()}"`,
          `"${r.status}"`,
        ];
        fields.forEach(f => {
          const val = r.submitted_data?.[f.field_name];
          if (val && typeof val === 'object') {
            base.push(`"${val.url ? `${api.BACKEND_URL}${val.url}` : '[File]'}"`);
          } else {
            base.push(`"${val !== undefined && val !== null ? String(val).replace(/"/g, '""') : ''}"`);
          }
        });
        return base.join(',');
      });

      const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `registrations-${camp.id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed. Please try again.');
    } finally {
      setExportingId(null);
    }
  };

  const handleDownloadAuditLog = async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/audit');
      const blob = new Blob([JSON.stringify(res.logs, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download audit logs.');
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 px-8 py-10">
        {/* decorative blobs */}
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-40 h-40 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="px-2 bg-white/20 rounded-xl">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="text-[11px] font-bold text-violet-200 uppercase tracking-widest">Analytics & Reports</span>
              </div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Reports Panel</h1>
              <p className="text-sm text-violet-200 mt-1.5 font-medium">
                Download CSV exports, view campaign statistics &amp; export audit logs
              </p>
            </div>

            {/* Quick stat pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Campaigns',    value: campaigns.length,   icon: <Megaphone className="h-4 w-4" />,   color: 'bg-white/20' },
                { label: 'Participants', value: totalParticipants,   icon: <Users className="h-4 w-4" />,       color: 'bg-white/20' },
                { label: 'Active',       value: publishedCount,      icon: <TrendingUp className="h-4 w-4" />,  color: 'bg-emerald-400/30' },
              ].map(s => (
                <div key={s.label} className={`${s.color} backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 text-white text-center min-w-[80px]`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1 opacity-80">{s.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span></div>
                  <div className="text-2xl font-extrabold leading-none">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── Campaign CSV Export Card (wider) ── */}
          <div className="xl:col-span-3 bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            
            {/* Card Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-xl">
                  <FileSpreadsheet className="h-4.5 w-4.5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Campaign CSV Exports</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Download participant data per campaign</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
                {campaigns.length} campaigns
              </span>
            </div>

            {/* Search */}
            <div className="px-6 pt-4 pb-3">
              <div className="relative">
                <Activity className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full text-xs pl-8.5 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Campaign List */}
            <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-2 max-h-[400px]">
              {loading ? (
                <div className="py-14 flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
                  <span className="text-xs font-semibold">Loading campaigns...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-2 text-slate-400">
                  <FileDown className="h-8 w-8 stroke-1" />
                  <span className="text-xs font-semibold">No campaigns found</span>
                </div>
              ) : (
                filtered.map((camp, i) => (
                  <div
                    key={camp.id}
                    className="group flex items-center justify-between gap-3 p-3.5 bg-white/50 hover:bg-violet-50/60 border border-white/60 hover:border-violet-200 rounded-xl transition-all duration-200 cursor-default"
                  >
                    {/* Left: index dot + info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800 truncate max-w-[200px] group-hover:text-violet-700 transition">
                          {camp.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {camp.total_registrations || 0} participants
                          </span>
                          <StatusBadge status={camp.status} />
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigate(`/campaign/details/${camp.id}`)}
                        className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                        title="View details"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleExportCSV(camp)}
                        disabled={exportingId === camp.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg shadow-sm shadow-violet-600/20 active:scale-95 transition-all"
                      >
                        {exportingId === camp.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />
                        }
                        {exportingId === camp.id ? 'Exporting…' : 'Export CSV'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right Column ── */}
          <div className="xl:col-span-2 flex flex-col gap-6">

            {/* Audit Log Card */}
            <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
              {/* gradient band */}
              <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400" />
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                    <ShieldCheck className="h-5 w-5 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Security Audit Log</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Admin activity &amp; event records</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Contains logins, campaign creation/deletions, registration status changes, and all privileged admin actions for compliance audit.
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-1.5">
                  {['Login Events', 'Campaign Actions', 'Status Changes', 'IP Tracking'].map(tag => (
                    <span key={tag} className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={handleDownloadAuditLog}
                  disabled={auditLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs shadow-md shadow-slate-900/20 active:scale-98 transition-all"
                >
                  {auditLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Download className="h-4 w-4" />
                  }
                  {auditLoading ? 'Preparing Download…' : 'Download Audit Logs (JSON)'}
                </button>
              </div>
            </div>

            {/* Summary Stats Card */}
            <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-violet-50 rounded-xl border border-violet-100">
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Campaign Summary</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">At-a-glance portfolio metrics</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Total Campaigns',   value: campaigns.length,  color: 'bg-violet-500' },
                    { label: 'Total Participants', value: totalParticipants, color: 'bg-indigo-500' },
                    { label: 'Published / Active', value: publishedCount,    color: 'bg-emerald-500' },
                    { label: 'Closed',             value: closedCount,        color: 'bg-rose-500' },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${stat.color} shrink-0`} />
                        <span className="text-[11px] font-semibold text-slate-600">{stat.label}</span>
                      </div>
                      <span className="text-sm font-extrabold text-slate-800">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
