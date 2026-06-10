import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  Trash2, 
  Edit, 
  Copy, 
  Share2, 
  ExternalLink, 
  Eye, 
  Inbox,
  Filter,
  Check,
  Megaphone,
  Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../utils/api';

const categories = [
  'Health Camp',
  'Blood Donation',
  'Vaccination',
  'Awareness Program',
  'Survey',
  'Education Drive',
  'NGO Event',
  'Other'
];

const CampaignsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchVal, setSearchVal] = useState(searchParams.get('search') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
    }, 450);

    return () => {
      clearTimeout(handler);
    };
  }, [searchVal]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const q = [];
      if (search) q.push(`search=${encodeURIComponent(search)}`);
      if (category) q.push(`category=${encodeURIComponent(category)}`);
      if (status) q.push(`status=${encodeURIComponent(status)}`);
      const queryStr = q.length > 0 ? `?${q.join('&')}` : '';
      const data = await api.get(`/campaigns${queryStr}`);
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [search, category, status]);

  // Handle Duplication
  const handleDuplicate = async (id, title) => {
    if (!window.confirm(`Are you sure you want to duplicate "${title}"?`)) return;
    try {
      const res = await api.post(`/campaigns/${id}/duplicate`);
      alert('Campaign duplicated successfully!');
      navigate(`/campaign/edit/${res.campaignId}`);
    } catch (err) {
      alert(err.message || 'Duplication failed.');
    }
  };

  // Handle Delete
  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will delete all fields and registration submissions forever.`)) return;
    try {
      await api.delete(`/campaigns/${id}`);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      alert('Campaign deleted successfully.');
    } catch (err) {
      alert(err.message || 'Delete failed.');
    }
  };

  // Handle Share Link
  const handleShare = (campId) => {
    const url = `${window.location.origin}/campaign/${campId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(campId);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Download QR Code
  const downloadQR = (campId) => {
    const svgEl = document.getElementById(`qr-svg-${campId}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `campaign-${campId}-qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Campaign Directory</h2>
          <p className="text-sm text-slate-500 font-medium">Create, configure, monitor, and duplicate dynamic campaign workflows</p>
        </div>
        <button
          onClick={() => navigate('/campaign/create')}
          className="flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-lg shadow-violet-600/25 active:scale-98 transition duration-200 shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* Filters & Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search campaigns by name, disease, or purpose..."
            className="w-full text-xs pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 focus:outline-none focus:border-violet-500 transition"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-705 focus:outline-none focus:border-violet-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="Draft">Drafts Only</option>
            <option value="Published">Published Active</option>
            <option value="Closed">Closed Archived</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center items-center py-24 text-slate-500 font-semibold">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mr-3" />
          <span>Filtering campaigns...</span>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-md border border-white/40 py-16 px-6 text-center rounded-2xl flex flex-col items-center">
          <Inbox className="h-12 w-12 text-slate-400 mb-3 stroke-1" />
          <h3 className="font-bold text-slate-800 text-sm">No Campaigns Found</h3>
          <p className="text-xs text-slate-505 mt-1 max-w-xs leading-relaxed">No campaign records match your search or filter rules. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const hasBanner = !!camp.banner_url;
            return (
              <div 
                key={camp.id}
                onClick={() => navigate(`/campaign/details/${camp.id}`)}
                className="bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-white/60 transition duration-300 flex flex-col group cursor-pointer relative"
              >
                {/* Banner Thumbnail */}
                <div className="h-40 bg-slate-950/20 relative overflow-hidden shrink-0">
                  {hasBanner ? (
                    <img 
                      src={camp.banner_url.startsWith('/') ? `${api.BACKEND_URL}${camp.banner_url}` : camp.banner_url} 
                      alt={camp.title} 
                      className="w-full h-full object-cover group-hover:scale-103 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 flex flex-col items-center justify-center text-white px-4 text-center relative transition duration-500 overflow-hidden">
                      {/* Decorative glowing blobs */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-125" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/15 rounded-full blur-xl -ml-4 -mb-4 transition-transform duration-500 group-hover:scale-125" />
                      
                      <Megaphone className="h-7 w-7 text-white/95 mb-1.5 drop-shadow-md animate-pulse shrink-0" />
                      <span className="text-[12px] font-extrabold tracking-wide uppercase drop-shadow-sm truncate max-w-full block">
                        {camp.title}
                      </span>
                      <span className="text-[9px] text-white/70 font-bold tracking-wider uppercase block mt-0.5">
                        {camp.category}
                      </span>
                    </div>
                  )}

                  {/* Glassmorphic QR & Fast Actions Overlay (Top Left) */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2.5 left-2.5 flex items-center space-x-2 bg-white/90 backdrop-blur-md border border-white/50 p-1.5 rounded-xl shadow-md transition duration-200 hover:bg-white"
                  >
                    <div className="bg-white p-0.5 rounded-lg border border-slate-100/80">
                      <QRCodeSVG
                        id={`qr-svg-${camp.id}`}
                        value={`${window.location.origin}/campaign/${camp.id}`}
                        size={32}
                        level="M"
                      />
                    </div>
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={() => downloadQR(camp.id)}
                        title="Download QR Code"
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-violet-600 transition"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleShare(camp.id)}
                        title="Copy Share Link"
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-violet-600 transition"
                      >
                        {copiedId === camp.id ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Share2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Status Overlay Badge */}
                  <span className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md ${
                    camp.status === 'Published' 
                      ? 'bg-emerald-500 text-white' 
                      : camp.status === 'Closed' 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-slate-500 text-white'
                  }`}>
                    {camp.status}
                  </span>

                  {/* Category overlay bottom left */}
                  <span className="absolute bottom-2.5 left-2.5 bg-slate-950/60 backdrop-blur text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    {camp.category}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-slate-800 text-base leading-snug group-hover:text-violet-600 transition-colors line-clamp-1">
                      {camp.title}
                    </h3>
                    <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed">
                      {camp.description || 'No campaign description available.'}
                    </p>
                  </div>

                  {/* Micro stats */}
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-t border-slate-50 pt-3">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{camp.start_date ? camp.start_date.split('T')[0] : 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-bold text-slate-700">{camp.total_registrations || 0}</span>
                      <span>regs</span>
                    </div>
                  </div>
                </div>

                {/* Action card bar */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="px-5 py-3.5 bg-white/40 border-t border-white/20 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/campaign/edit/${camp.id}`)}
                      title="Edit Campaign"
                      className="p-1.5 bg-white border border-slate-205 text-slate-600 rounded-lg hover:border-violet-500 hover:text-violet-500 transition"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(camp.id, camp.title)}
                      title="Duplicate"
                      className="p-1.5 bg-white border border-slate-205 text-slate-600 rounded-lg hover:border-violet-500 hover:text-violet-500 transition"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(camp.id, camp.title)}
                      title="Delete Campaign"
                      className="p-1.5 bg-white border border-slate-205 hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500 text-slate-500 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleShare(camp.id)}
                      title="Copy Public Link"
                      className="flex items-center space-x-1 px-3 py-2 text-[10px] font-extrabold text-violet-600 hover:text-white hover:bg-violet-600 rounded-xl border border-violet-100 hover:border-violet-600 transition duration-150"
                    >
                      {copiedId === camp.id ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3 w-3" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`/campaign/${camp.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                      title="Go to Live Public Form"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignsList;
