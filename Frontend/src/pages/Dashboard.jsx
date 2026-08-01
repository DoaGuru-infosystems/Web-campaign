import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Megaphone, 
  Users, 
  CalendarRange, 
  Clock, 
  Plus, 
  ArrowRight,
  TrendingUp,
  Inbox,
  UserCheck
} from 'lucide-react';
import api from '../utils/api';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    try {
      const [dashData, chartData] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/analytics/charts'),
      ]);
      setData(dashData);
      setCharts(chartData);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] text-slate-500">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-semibold">Loading dashboard intelligence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-md mx-auto text-center py-12 px-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl">
          <p className="text-rose-400 font-semibold mb-4">{error}</p>
          <button onClick={() => loadDashboardData(true)} className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#e11d48', '#3b82f6', '#10b981', '#f59e0b'];

  const stats = data.stats || {};
  const recentCampaigns = data.recent_campaigns || [];
  const recentParticipants = data.recent_participants || [];

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
      
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Analytics</h2>
          <p className="text-sm text-slate-500 font-medium">Real-time overview of campaign performance and audience registrations</p>
        </div>
        <button
          onClick={() => navigate('/campaign/create')}
          className="flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-lg shadow-violet-600/20 active:scale-98 transition-all duration-200"
        >
          <Plus className="h-4.5 w-4.5" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 font-sans">
        
        {/* Stat 1 */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5.5 rounded-2xl flex items-center space-x-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="p-3.5 bg-indigo-50 text-indigo-650 rounded-xl border border-indigo-100/50 shrink-0">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Campaigns</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1 leading-none">{stats.total_campaigns || 0}</h3>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5.5 rounded-2xl flex items-center space-x-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="p-3.5 bg-emerald-50 text-emerald-650 rounded-xl border border-emerald-100/50 shrink-0">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Campaigns</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1 leading-none">{stats.active_campaigns || 0}</h3>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5.5 rounded-2xl flex items-center space-x-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="p-3.5 bg-violet-50 text-violet-650 rounded-xl border border-violet-100/50 shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registrations</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1 leading-none">{stats.total_registrations || 0}</h3>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5.5 rounded-2xl flex items-center space-x-4.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="p-3.5 bg-purple-50 text-purple-650 rounded-xl border border-purple-100/50 shrink-0">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registrations Today</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1 leading-none">{stats.registrations_today || 0}</h3>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Campaign Registrations */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <TrendingUp className="h-4.5 w-4.5 text-violet-500" />
            <span>Campaign-wise Registrations</span>
          </h4>
          <div className="h-72 w-full text-xs">
            {charts?.campaign_wise?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.campaign_wise} margin={{ bottom: 20 }}>
                  <XAxis dataKey="campaign_title" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                  <YAxis stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No campaign registrations recorded yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Daily Registrations */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
            <span>Daily Registration Trends (Last 14 Days)</span>
          </h4>
          <div className="h-72 w-full text-xs">
            {charts?.daily?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.daily}>
                  <XAxis dataKey="date" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} />
                  <YAxis stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} dot={{ strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No registrations in the last 14 days</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Monthly Growth */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
            <span>Monthly Growth Curve</span>
          </h4>
          <div className="h-72 w-full text-xs">
            {charts?.monthly?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.monthly}>
                  <XAxis dataKey="month" stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke="#888888" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} dot={{ strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No growth statistics to display</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Category distribution */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <TrendingUp className="h-4.5 w-4.5 text-purple-500" />
            <span>Category Performance</span>
          </h4>
          <div className="h-72 w-full text-xs flex items-center justify-center">
            {charts?.category_wise?.length > 0 ? (
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-center">
                <div className="w-full sm:w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.category_wise}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {charts.category_wise.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 flex flex-col space-y-2 mt-4 sm:mt-0 sm:pl-4 max-h-60 overflow-y-auto">
                  {charts.category_wise.map((entry, index) => (
                    <div key={entry.name} className="flex items-center space-x-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px]">{entry.name}</span>
                      <span className="text-[11px] font-bold text-slate-500">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No campaigns categorized yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timelines and lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Campaigns (Col-1 & Col-2) */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4.5">
            <h4 className="text-base font-extrabold text-slate-800 tracking-tight">Recent Campaigns</h4>
            <Link to="/campaigns" className="text-xs font-bold text-violet-650 hover:text-violet-550 flex items-center space-x-1">
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {recentCampaigns.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No campaigns created yet.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 font-semibold">Campaign Title</th>
                    <th className="py-3 font-semibold">Category</th>
                    <th className="py-3 font-semibold">Status</th>
                    <th className="py-3 font-semibold text-center">Registrations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentCampaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5">
                        <Link to={`/campaign/details/${camp.id}`} className="font-bold text-slate-700 hover:text-violet-650 transition-colors">
                           {camp.title}
                        </Link>
                      </td>
                      <td className="py-3.5 text-slate-550 font-medium">{camp.category}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.status === 'Published' 
                            ? 'bg-emerald-50 text-emerald-600' 
                            : camp.status === 'Closed' 
                            ? 'bg-rose-50 text-rose-600' 
                            : 'bg-slate-50 text-slate-650'
                        }`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-center font-bold text-slate-700">{camp.registrations_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Participant Submissions (Col-3) */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-5 rounded-2xl shadow-sm flex flex-col">
          <h4 className="text-base font-extrabold text-slate-800 tracking-tight mb-4.5">Recent Participant Actions</h4>
          <div className="flex-1 space-y-4 overflow-y-auto max-h-72 pr-1">
            {recentParticipants.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs flex-col py-8">
                <Inbox className="h-8 w-8 mb-2 stroke-1" />
                <span>No submissions recorded yet</span>
              </div>
            ) : (
              recentParticipants.map((part) => (
                <div key={part.id} className="flex items-start space-x-3.5 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="h-8 w-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 text-xs font-bold shrink-0">
                    <UserCheck className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700 truncate">{part.name}</p>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {new Date(part.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-505 mt-0.5 truncate font-medium">
                      Registered for: <span className="font-semibold text-slate-600">{part.campaign_title}</span>
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">{part.registration_id}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        part.status === 'Approved' || part.status === 'Verified'
                          ? 'bg-emerald-50 text-emerald-600'
                          : part.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {part.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
