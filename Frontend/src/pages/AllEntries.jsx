import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Filter, ChevronLeft, ChevronRight,
  Inbox, Loader2, X, Calendar, Users, Database,
  RefreshCw, ExternalLink, SlidersHorizontal
} from 'lucide-react';
import api from '../utils/api';

const STATUS_COLORS = {
  Approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Verified: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Pending:  'bg-amber-50  text-amber-600  border-amber-200',
  Rejected: 'bg-rose-50   text-rose-600   border-rose-200',
};

const DATE_PRESETS = [
  { label: 'Today',       getValue: () => { const d = new Date().toISOString().slice(0,10); return { from: d, to: d }; } },
  { label: 'Last 7 days', getValue: () => { const t = new Date(), f = new Date(); f.setDate(f.getDate()-6); return { from: f.toISOString().slice(0,10), to: t.toISOString().slice(0,10) }; } },
  { label: 'This Month',  getValue: () => { const n = new Date(); return { from: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, to: n.toISOString().slice(0,10) }; } },
  { label: 'Last Month',  getValue: () => { const n = new Date(); n.setMonth(n.getMonth()-1); const y=n.getFullYear(), m=n.getMonth()+1; return { from: `${y}-${String(m).padStart(2,'0')}-01`, to: `${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}` }; } },
];

export default function AllEntries() {
  const navigate = useNavigate();

  // Filters
  const [search,      setSearch]      = useState('');
  const [campaignId,  setCampaignId]  = useState('');
  const [status,      setStatus]      = useState('');
  const [gender,      setGender]      = useState('');
  const [disease,     setDisease]     = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [page,        setPage]        = useState(1);
  const LIMIT = 10;

  // Data
  const [rows,          setRows]          = useState([]);
  const [campaigns,     setCampaigns]     = useState([]);
  const [diseaseValues, setDiseaseValues] = useState([]);
  const [pagination,    setPagination]    = useState({ total: 0, total_pages: 1 });
  const [loading,       setLoading]       = useState(true);
  const [exporting,     setExporting]     = useState(false);
  const [showFilters,   setShowFilters]   = useState(true);

  const activeFilters = [campaignId, status, gender, disease, dateFrom, dateTo]
    .filter(Boolean).length;

  const fetchData = useCallback(async (resetPage = false) => {
    setLoading(true);
    const p = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      const q = new URLSearchParams({ page: p, limit: LIMIT });
      if (search)     q.set('search',      search);
      if (campaignId) q.set('campaign_id', campaignId);
      if (status)     q.set('status',      status);
      if (gender)     q.set('gender',      gender);
      if (disease)    q.set('disease',     disease);
      if (dateFrom)   q.set('date_from',   dateFrom);
      if (dateTo)     q.set('date_to',     dateTo);

      const data = await api.get(`/registrations/all?${q}`);
      setRows(data.registrations || []);
      setCampaigns(data.campaigns || []);
      setDiseaseValues(data.diseaseValues || []);
      setPagination(data.pagination || { total: 0, total_pages: 1 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, campaignId, status, gender, disease, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [page]);

  const applyFilters = () => fetchData(true);
  const clearFilters = () => {
    setSearch(''); setCampaignId(''); setStatus('');
    setGender(''); setDisease(''); setDateFrom(''); setDateTo('');
    setPage(1);
    setTimeout(() => fetchData(true), 0);
  };

  const applyPreset = (preset) => {
    const { from, to } = preset.getValue();
    setDateFrom(from); setDateTo(to);
  };

  // Derive column labels from first few rows
  const commonKeys = rows.length > 0
    ? Object.keys(rows[0].submitted_data || {})
        .filter(k => !k.startsWith('__other_'))
        .slice(0, 4)
    : [];

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams({ page: 1, limit: 9999 });
      if (search)     q.set('search',      search);
      if (campaignId) q.set('campaign_id', campaignId);
      if (status)     q.set('status',      status);
      if (gender)     q.set('gender',      gender);
      if (disease)    q.set('disease',     disease);
      if (dateFrom)   q.set('date_from',   dateFrom);
      if (dateTo)     q.set('date_to',     dateTo);

      const token = api.getToken();
      const res = await fetch(`${api.BACKEND_URL}/api/registrations/all?${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { alert('Export failed.'); return; }
      const data = await res.json();
      const allRows = data.registrations || [];
      if (!allRows.length) { alert('No data to export.'); return; }

      const keys = allRows.length > 0 ? Object.keys(allRows[0].submitted_data || {}).filter(k => !k.startsWith('__other_')) : [];
      const headers = ['Reg ID', 'Campaign', 'Date', 'Status', ...keys].map(h => `"${h}"`).join(',');
      const csvRows = allRows.map(r => {
        const base = [
          `"${r.registration_id}"`,
          `"${r.campaign_title}"`,
          `"${new Date(r.created_at).toLocaleDateString()}"`,
          `"${r.status}"`,
        ];
        keys.forEach(k => {
          const v = r.submitted_data?.[k];
          const s = Array.isArray(v) ? v.join('; ') : (v != null ? String(v) : '');
          base.push(`"${s.replace(/"/g, '""')}"`);
        });
        return base.join(',');
      });
      const csv = '\uFEFF' + [headers, ...csvRows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `all-entries-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); alert('Export failed.'); }
    finally { setExporting(false); }
  };

  const getCellValue = (submitted_data, key) => {
    const v = submitted_data?.[key];
    if (v == null) return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return '[File]';
    return String(v);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 px-8 py-9">
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-24 w-40 h-40 rounded-full bg-purple-400/20 blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-xl"><Database className="h-5 w-5 text-white" /></div>
              <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest">Global Registry</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">All Entries</h1>
            <p className="text-sm text-indigo-200 mt-1 font-medium">Every submission across all campaigns — searchable &amp; filterable</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Total Entries', value: pagination.total, icon: <Users className="h-4 w-4" /> },
              { label: 'Campaigns',     value: campaigns.length, icon: <Database className="h-4 w-4" /> },
            ].map(s => (
              <div key={s.label} className="bg-white/20 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 text-white text-center min-w-[90px]">
                <div className="flex items-center justify-center gap-1 opacity-80 mb-1">{s.icon}<span className="text-[9px] font-bold uppercase tracking-wider">{s.label}</span></div>
                <div className="text-2xl font-extrabold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-5">

        {/* ── Filter Panel ── */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-transparent">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-extrabold text-slate-800">Filters</span>
              {activeFilters > 0 && (
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">{activeFilters} active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 transition">
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
              <button onClick={() => setShowFilters(p => !p)} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition">
                {showFilters ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-5 space-y-4">
              {/* Row 1: Search + Campaign + Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                    placeholder="Search name, ID, campaign..."
                    className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition" />
                </div>
                <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                  className="text-sm px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-400 transition">
                  <option value="">All Campaigns</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="text-sm px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-400 transition">
                  <option value="">All Statuses</option>
                  {['Pending','Verified','Approved','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Row 2: Gender + Disease */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 shrink-0">Gender:</span>
                  <div className="flex gap-2 flex-wrap">
                    {['', 'Male', 'Female', 'Other'].map(g => (
                      <button key={g} onClick={() => setGender(g)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${gender === g ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400'}`}>
                        {g || 'All'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-500 shrink-0">Disease:</span>
                  {diseaseValues.length > 0 ? (
                    <select value={disease} onChange={e => setDisease(e.target.value)}
                      className="flex-1 text-sm px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 focus:outline-none focus:border-rose-400 transition">
                      <option value="">All Diseases</option>
                      {diseaseValues.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={disease} onChange={e => setDisease(e.target.value)}
                      placeholder="Type disease name..."
                      className="flex-1 text-sm px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 placeholder-rose-300 focus:outline-none focus:border-rose-400 transition" />
                  )}
                </div>
              </div>

              {/* Row 3: Date presets + custom range */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Date:</span>
                  {DATE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 transition">
                      {p.label}
                    </button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-700 flex items-center gap-0.5 transition">
                      <X className="h-3 w-3" /> Clear date
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">From</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-400 transition" />
                  <span className="text-xs text-slate-400 font-semibold">To</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="text-sm px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-400 transition" />
                </div>
              </div>

              {/* Apply / Export */}
              <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                <button onClick={applyFilters}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition">
                  <Filter className="h-4 w-4" /> Apply Filters
                </button>
                <button onClick={() => fetchData()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition">
                  <RefreshCw className="h-4 w-4" /> Refresh
                </button>
                <div className="flex-1" />
                <button onClick={handleExportCSV} disabled={exporting}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm active:scale-95 transition disabled:opacity-50">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Results Table ── */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-800">Results</span>
              <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-200">
                {pagination.total} entries
              </span>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              Page {page} of {pagination.total_pages}
            </span>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Loading entries...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-24 flex flex-col items-center gap-3 text-slate-400">
              <Inbox className="h-10 w-10 stroke-1" />
              <span className="text-xs font-semibold">No entries match the current filters</span>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="text-xs text-indigo-500 font-bold hover:underline">Clear filters</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Reg ID</th>
                    <th className="py-3.5 px-4">Campaign</th>
                    <th className="py-3.5 px-4">Date</th>
                    {commonKeys.map(k => (
                      <th key={k} className="py-3.5 px-4 truncate max-w-[110px]">{k.replace(/_/g,' ')}</th>
                    ))}
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 text-xs">{r.registration_id}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-bold text-slate-700 block truncate max-w-[150px]">{r.campaign_title}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{r.campaign_category}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-semibold text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                      {commonKeys.map(k => {
                        const isDisease = /disease/i.test(k);
                        const cell = getCellValue(r.submitted_data, k);
                        if (isDisease) {
                          const vals = Array.isArray(r.submitted_data?.[k]) ? r.submitted_data[k] : (r.submitted_data?.[k] ? [String(r.submitted_data[k])] : []);
                          return (
                             <td key={k} className="py-3.5 px-4">
                              <div className="flex flex-wrap gap-1">
                                {vals.length > 0 ? vals.map((v, i) => (
                                  <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">{v}</span>
                                )) : <span className="text-slate-300">—</span>}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={k} className="py-3.5 px-4 text-slate-600 font-medium text-xs truncate max-w-[120px]" title={cell}>{cell}</td>
                        );
                      })}
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button onClick={() => navigate(`/campaign/details/${r.campaign_id}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg transition">
                          <ExternalLink className="h-3 w-3" /> Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 text-sm font-semibold text-slate-500">
              <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.total)} of {pagination.total}</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(pagination.total_pages, 7) }, (_, i) => {
                  const pg = pagination.total_pages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= pagination.total_pages - 3 ? pagination.total_pages - 6 + i
                    : page - 3 + i;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition ${page === pg ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                      {pg}
                    </button>
                  );
                })}
                <button disabled={page === pagination.total_pages} onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
