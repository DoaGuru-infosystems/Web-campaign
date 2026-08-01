import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  Clock, 
  Download, 
  ExternalLink, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  FileText,
  Image as ImageIcon,
  Printer,
  Inbox
} from 'lucide-react';
import api from '../utils/api';
import { QRCodeSVG } from 'qrcode.react';

const CampaignDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState(null);
  const [fields, setFields] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegsCount, setTotalRegsCount] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Modal participant drawer
  const [selectedReg, setSelectedReg] = useState(null);
  const [selectedRegDetails, setSelectedRegDetails] = useState(null);

  // Link copy check
  const [copiedLink, setCopiedLink] = useState(false);

  // QR refs
  const qrRef = useRef(null);

  useEffect(() => {
    const fetchCampaignData = async () => {
      try {
        const data = await api.get(`/campaigns/${id}`);
        setCampaign(data.campaign);
        setFields(data.fields || []);
      } catch (err) {
        console.error(err);
        setError('Failed to retrieve campaign details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCampaignData();
  }, [id]);

  useEffect(() => {
    const fetchRegistrations = async () => {
      setRegLoading(true);
      try {
        const query = new URLSearchParams({
          page,
          limit,
          search,
          status: statusFilter
        }).toString();
        const data = await api.get(`/registrations/campaign/${id}?${query}`);
        setRegistrations(data.registrations || []);
        // Backend returns pagination inside a nested object with snake_case keys
        setTotalPages(data.pagination?.total_pages || 1);
        setTotalRegsCount(data.pagination?.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setRegLoading(false);
      }
    };
    if (campaign) {
      fetchRegistrations();
    }
  }, [id, campaign, page, limit, search, statusFilter]);

  const handleUpdateStatus = async (regId, newStatus) => {
    try {
      await api.put(`/registrations/${regId}/status`, { status: newStatus });
      
      // Update local state list
      setRegistrations(prev => prev.map(r => r.id === regId ? { ...r, status: newStatus } : r));
      
      // Update modal state if open
      if (selectedReg && selectedReg.id === regId) {
        setSelectedReg(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update registration status.');
    }
  };

  const openParticipantDetails = async (regId) => {
    const reg = registrations.find(r => r.id === regId);
    if (!reg) return;
    
    setSelectedReg(reg);
    try {
      const details = await api.get(`/registrations/${regId}`);
      setSelectedRegDetails(details);
    } catch (err) {
      console.error(err);
      alert('Could not retrieve full profile details.');
    }
  };

  const handleCopyLink = () => {
    const publicUrl = `${window.location.origin}/campaign/${id}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // QR downloads
  const downloadQR_PNG = () => {
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) {
      // SVG fallback png render
      const svg = qrRef.current.querySelector('svg');
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvasEl = document.createElement('canvas');
      const ctx = canvasEl.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvasEl.width = img.width;
        canvasEl.height = img.height;
        ctx.drawImage(img, 0, 0);
        const pngFile = canvasEl.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `campaign-${id}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      return;
    }
    const pngUrl = canvas
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream');
    let downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `campaign-${id}-qr.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const downloadQR_SVG = () => {
    const svgEl = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `campaign-${id}-qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleExportCSV = async () => {
    try {
      // Use raw fetch (not api.get) so a 401 error does NOT trigger the
      // global redirect logic in api.js which would bounce us to /campaigns.
      const token = api.getToken();
      const response = await fetch(
        `${api.BACKEND_URL}/api/registrations/export/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        alert(errData.error || 'Failed to fetch export data from server.');
        return;
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        alert('No submissions found to export.');
        return;
      }

      // Generate CSV headers
      const csvHeaders = ['Registration ID', 'Submitted Date', 'Status'];
      fields.forEach(f => csvHeaders.push(`"${f.label}"`));

      // Map each registration into a CSV row
      const csvRows = data.map(r => {
        const row = [
          `"${r.registration_id}"`,
          `"${new Date(r.created_at).toLocaleDateString()}"`,
          `"${r.status}"`
        ];
        fields.forEach(f => {
          const val = r.submitted_data[f.field_name];
          if (val && typeof val === 'object') {
            // File / image upload field
            const display = val.url
              ? `${api.BACKEND_URL}${val.url}`
              : '[Uploaded Attachment]';
            row.push(`"${display}"`);
          } else {
            const safeVal = val !== undefined && val !== null
              ? String(val).replace(/"/g, '""')
              : '';
            row.push(`"${safeVal}"`);
          }
        });
        return row.join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `registrations-campaign-${id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('An unexpected error occurred while generating the export.');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-semibold">Retrieving campaign intelligence...</span>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-md mx-auto text-center py-12 px-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl">
          <p className="text-rose-400 font-semibold mb-4">{error}</p>
          <button onClick={() => navigate('/campaigns')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition">
            Back to Directory
          </button>
        </div>
      </div>
    );
  }

  const campaignPublicUrl = `${window.location.origin}/campaign/${id}`;

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      
      {/* Back Button */}
      <div>
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 transition space-x-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Campaigns</span>
        </button>
      </div>

      {/* Main Campaign Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch font-sans">
        
        {/* Info Card (Left 2/3) */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/40 p-6.5 rounded-2xl shadow-sm flex flex-col justify-between space-y-5">
          
          {/* Title & Banner */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-600">
                  {campaign.category}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  campaign.status === 'Published' 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : campaign.status === 'Closed' 
                    ? 'bg-rose-50 text-rose-600' 
                    : 'bg-slate-50 text-slate-650'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{campaign.title}</h2>
              <p className="text-sm text-slate-500 max-w-xl leading-relaxed">{campaign.description || 'No description provided.'}</p>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => navigate(`/campaign/edit/${id}`)}
                className="px-4.5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-650/15 hover:shadow-violet-650/25 active:scale-95 transition"
              >
                Edit Form Builder
              </button>
              <a
                href={campaignPublicUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-xl transition"
                title="View Public Form"
              >
                <ExternalLink className="h-4.5 w-4.5" />
              </a>
            </div>
          </div>

          {/* Campaign info cards (dates / limit) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-5 border-t border-slate-100">
            <div>
              <span className="block text-[11px] uppercase font-bold text-slate-400 tracking-wider">Start Date</span>
              <span className="text-sm font-bold text-slate-700">{campaign.start_date ? campaign.start_date.split('T')[0] : 'N/A'}</span>
            </div>
            <div>
              <span className="block text-[11px] uppercase font-bold text-slate-400 tracking-wider">End Date</span>
              <span className="text-sm font-bold text-slate-700">{campaign.end_date ? campaign.end_date.split('T')[0] : 'N/A'}</span>
            </div>
            <div>
              <span className="block text-[11px] uppercase font-bold text-slate-400 tracking-wider">Registration Limit</span>
              <span className="text-sm font-bold text-slate-700">
                {campaign.submission_limit ? `${campaign.submission_limit} max` : 'Unlimited'}
              </span>
            </div>
          </div>
        </div>

        {/* Sharing & QR Card (Right 1/3) */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-6.5 rounded-2xl shadow-sm flex flex-col justify-between space-y-3.5">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2.5 w-full text-left tracking-tight">QR Sharing Asset</h3>
          
          <div className="flex flex-row items-center gap-4 flex-1">
            {/* QR Render */}
            <div ref={qrRef} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0">
              <QRCodeSVG
                value={campaignPublicUrl}
                size={95}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Link Copy & Downloads */}
            <div className="flex-1 space-y-2.5 w-full min-w-0">
              <div className="flex items-center bg-slate-50 border border-slate-200 p-2 rounded-xl text-left overflow-hidden">
                <span className="text-[10px] font-mono text-slate-500 truncate flex-1 select-all pl-1">{campaignPublicUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="ml-2 px-2.5 py-1 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition whitespace-nowrap"
                >
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Downloads */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={downloadQR_PNG}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 rounded-xl border border-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  onClick={downloadQR_SVG}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-[10px] font-bold text-slate-700 rounded-xl border border-slate-200 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>SVG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registrations List Section */}
      <div className="bg-white/70 backdrop-blur-md border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
        
        {/* Section Header with Exports */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <h3 className="font-bold text-slate-800 text-sm">Registrations Dashboard</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
              {totalRegsCount} Submissions
            </span>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-105 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition"
          >
            <Download className="h-4 w-4" />
            <span>Export Submissions (CSV)</span>
          </button>
        </div>

        {/* Filters and Searches */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search box */}
          <div className="relative w-80 max-w-full">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by participant details..."
              className="w-full text-xs pl-9.5 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs text-slate-400 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-500 transition"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* SCHEMA-DRIVEN TABLE */}
        {regLoading && registrations.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs font-semibold">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span>Loading registrations data...</span>
          </div>
        ) : registrations.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center">
            <Inbox className="h-10 w-10 mb-2 stroke-1" />
            <span>No registrations matches filters.</span>
          </div>
        ) : (
          <div className="relative border border-white/20 rounded-2xl overflow-hidden">
            {regLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all duration-200">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-150 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-4 font-bold">Registration ID</th>
                    <th className="py-4 px-4 font-bold">Date</th>
                    
                    {/* Dynamic field columns (showing first 4 fields to avoid table bloating) */}
                    {fields.slice(0, 4).map(f => (
                      <th key={f.field_name} className="py-4 px-4 font-bold truncate max-w-[130px]">{f.label}</th>
                    ))}

                    <th className="py-4 px-4 font-bold">Status</th>
                    <th className="py-4 px-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-700">{r.registration_id}</td>
                      <td className="py-4 px-4 text-slate-400 font-semibold">{new Date(r.created_at).toLocaleDateString()}</td>

                      {/* Dynamic field values */}
                      {fields.slice(0, 4).map(f => {
                        const value = r.submitted_data[f.field_name];
                        let formatted = '-';
                        
                        if (value !== undefined && value !== null) {
                          if (typeof value === 'object') {
                            formatted = '[Uploaded File]';
                          } else {
                            formatted = String(value);
                          }
                        }
                        
                        return (
                          <td key={f.field_name} className="py-4 px-4 text-slate-600 font-medium truncate max-w-[130px]" title={formatted}>
                            {formatted}
                          </td>
                        );
                      })}

                      {/* Status Badge Select dropdown */}
                      <td className="py-4 px-4">
                        <select
                          value={r.status}
                          onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-transparent focus:outline-none transition ${
                            r.status === 'Approved' || r.status === 'Verified'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : r.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => openParticipantDetails(r.id)}
                          className="text-[11px] font-extrabold text-violet-600 hover:text-white bg-violet-50 hover:bg-violet-600 px-3 py-1.5 rounded-xl transition duration-150"
                        >
                          Open Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-405">
            <span>Showing page {page} of {totalPages}</span>
            <div className="flex items-center space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border border-slate-250 hover:bg-slate-50 rounded-xl disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 border border-slate-250 hover:bg-slate-50 rounded-xl disabled:opacity-40 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PARTICIPANT DETAILS MODAL/DRAWER */}
      {selectedReg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/85 backdrop-blur-md border border-white/40 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200 font-sans">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h4 className="text-base font-bold text-slate-800">Participant Submission Profile</h4>
                <p className="text-[11px] text-slate-450 font-mono mt-0.5">ID: {selectedReg.registration_id} • Filed: {new Date(selectedReg.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => { setSelectedReg(null); setSelectedRegDetails(null); }}
                className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!selectedRegDetails ? (
              <div className="py-20 text-center text-slate-500">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <span className="text-sm font-semibold">Retrieving profile parameters...</span>
              </div>
            ) : (
              <>
                {/* Modal Content */}
                <div className="flex-1 space-y-6 text-xs text-left" id="printable-profile">
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registration ID</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">{selectedReg.registration_id}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Status</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <select
                          value={selectedReg.status}
                          onChange={(e) => handleUpdateStatus(selectedReg.id, e.target.value)}
                          className={`text-xs font-extrabold px-3 py-1 rounded-xl border border-transparent focus:outline-none transition ${
                            selectedReg.status === 'Approved' || selectedReg.status === 'Verified'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : selectedReg.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Verified">Verified</option>
                          <option value="Approved">Approved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic inputs values list */}
                  <div className="space-y-4">
                    <h5 className="text-xs font-bold text-slate-700 border-l-2 border-violet-500 pl-2 tracking-tight">Submitted Field Responses</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedRegDetails.fields.map(f => {
                        const value = selectedReg.submitted_data[f.field_name];
                        
                        return (
                          <div key={f.field_name} className="p-3.5 bg-white/40 border border-white/30 rounded-xl space-y-1.5 shadow-2xs">
                            <span className="block text-[11px] text-slate-400 font-semibold">{f.label}</span>
                            
                            {/* If field is files/uploads */}
                            {['Single Image Upload', 'Single PDF Upload', 'Signature Upload', 'File Upload'].includes(f.field_type) && value?.url ? (
                              <div className="pt-1 flex items-center justify-between">
                                {f.field_type === 'Single Image Upload' || f.field_type === 'Signature Upload' ? (
                                  <div className="rounded-lg overflow-hidden border border-slate-200 max-h-16 w-24 bg-slate-900 flex items-center justify-center shrink-0">
                                    <img src={`${api.BACKEND_URL}${value.url}`} alt={f.label} className="object-contain w-full h-full" />
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1.5 text-slate-650 font-semibold text-xs">
                                    <FileText className="h-4.5 w-4.5 text-slate-400 animate-pulse" />
                                    <span className="truncate max-w-[150px]">{value.filename || 'Document'}</span>
                                  </div>
                                )}
                                <a
                                  href={`${api.BACKEND_URL}${value.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-bold text-violet-600 hover:underline flex items-center space-x-0.5 ml-2"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Get file</span>
                                </a>
                              </div>
                            ) : ['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type) && Array.isArray(value) ? (
                              <div className="pt-1.5 space-y-1.5">
                                {value.map((fileObj, fIdx) => (
                                  <div key={fIdx} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                                    <span className="truncate max-w-[150px] text-slate-600 font-semibold text-xs">{fileObj.filename || `File ${fIdx + 1}`}</span>
                                    <a
                                      href={`${api.BACKEND_URL}${fileObj.url}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] font-bold text-violet-600 hover:underline"
                                    >
                                      Download
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              // Normal simple string values
                              <span className="font-semibold text-slate-800 text-[13px] break-words block">
                                {value !== undefined && value !== null && value !== '' ? String(value) : '-'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Uploads details */}
                  {selectedRegDetails.files && selectedRegDetails.files.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <h5 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                        <span>Associated Binary Files ({selectedRegDetails.files.length})</span>
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedRegDetails.files.map(file => (
                          <div key={file.id} className="p-3 border border-white/30 rounded-xl flex flex-col justify-between space-y-2 bg-white/40 shadow-2xs">
                            <span className="font-mono text-[10px] text-slate-450 truncate block">{file.file_name}</span>
                            <span className="text-[10px] text-slate-400">Size: {(file.file_size / 1024).toFixed(1)} KB</span>
                            <a
                              href={`${api.BACKEND_URL}${file.file_path}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full flex items-center justify-center space-x-1.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-bold shadow-xs transition"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download file</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer (Actions) */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0">
                  <button
                    onClick={() => { setSelectedReg(null); setSelectedRegDetails(null); }}
                    className="px-4.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-750 text-xs font-bold rounded-xl transition"
                  >
                    Close Profile
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4.5 py-2.5 rounded-xl transition"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Profile</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignDetails;
