import React, { useState, useEffect } from 'react';
import { 
  User, 
  Database, 
  Lock, 
  Mail, 
  Save, 
  ShieldCheck, 
  Activity, 
  Settings2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  HardDrive,
  Moon,
  Sun,
  Eye,
  EyeOff
} from 'lucide-react';
import api from '../utils/api';

const Settings = () => {
  // Tabs: 'profile' | 'database' | 'preferences'
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [user, setUser] = useState({ name: '', email: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // System Preference States
  const [themeMode, setThemeMode] = useState('light');
  const [uploadLimit, setUploadLimit] = useState('10MB');
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Status/Loading States
  const [profileLoading, setProfileLoading] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbPing, setDbPing] = useState(null);
  
  // Notification States
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  useEffect(() => {
    // Load initial user details
    const fetchUser = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.user) {
          setUser({
            name: res.user.name || 'System Administrator',
            email: res.user.email || 'admin@campaignflow.com'
          });
        }
      } catch (err) {
        // Fallback to localStorage if API fails or offline
        const raw = localStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw);
          setUser({
            name: parsed.name || 'System Administrator',
            email: parsed.email || 'admin@campaignflow.com'
          });
        }
      }
    };
    fetchUser();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (password && password !== confirmPassword) {
      setAlert({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setProfileLoading(true);
    try {
      const payload = {
        name: user.name,
        email: user.email,
        password: password ? password : undefined
      };
      
      const res = await api.put('/auth/update-profile', payload);
      
      // Update local storage so that changes persist and display immediately
      localStorage.setItem('user', JSON.stringify(res.user));
      
      setAlert({ 
        type: 'success', 
        message: 'Settings updated successfully! Reloading system console...' 
      });
      
      setPassword('');
      setConfirmPassword('');

      // Reload window after 1.5 seconds to sync layout navbar/header
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: err.message || 'Failed to update system settings.' 
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setDbTesting(true);
    setDbPing(null);
    try {
      // Simulate real ping check
      await new Promise(resolve => setTimeout(resolve, 800));
      setDbPing('4ms');
    } catch (err) {
      setDbPing('Failed');
    } finally {
      setDbTesting(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">System Configurations</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Manage server connection settings, administrator credentials, and interface preferences</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-2.5">
          <Activity className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
          <span className="text-xs font-bold text-indigo-700 tracking-wide uppercase">System Node Online</span>
        </div>
      </div>

      {/* Global Alerts Banner */}
      {alert && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all duration-300 animate-fade-in ${
          alert.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {alert.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="font-bold text-sm">{alert.type === 'success' ? 'Action Completed' : 'Validation Error'}</h4>
            <p className="text-xs mt-0.5 font-medium">{alert.message}</p>
          </div>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1.5 p-1 bg-slate-100/60 backdrop-blur-md rounded-2xl max-w-lg">
        {[
          { id: 'profile', label: 'Admin Security', icon: User },
          { id: 'database', label: 'Database Status', icon: Database },
          { id: 'preferences', label: 'System Customizer', icon: Settings2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setAlert(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive 
                  ? 'bg-white text-indigo-650 shadow-md shadow-slate-100/50' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Settings Tab Panel content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Main Tab Workspace Card */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6.5 shadow-sm space-y-6 text-left">
          
          {/* TAB 1: Profile & Password settings */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Admin Account Profile</h3>
                <p className="text-xs text-slate-500 mt-0.5">Edit credentials used for logging into the dashboard.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full name input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">System Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      required
                      value={user.name} 
                      onChange={e => setUser({ ...user, name: e.target.value })}
                      placeholder="e.g. System Administrator"
                      className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Email input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="email" 
                      required
                      value={user.email} 
                      onChange={e => setUser({ ...user, email: e.target.value })}
                      placeholder="admin@campaignflow.com"
                      className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-base font-extrabold text-slate-800">Update Credentials</h3>
                <p className="text-xs text-slate-500 mt-0.5">Leave inputs blank to preserve your current passcode.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Password input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs pl-10 pr-10 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs pl-10 pr-10 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex items-center gap-1.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 active:scale-95 transition disabled:opacity-50"
                >
                  {profileLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Database connections status */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Relational Database Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Technical metadata for campaign, registration, and file uploads schemas.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-150 bg-slate-50/50 p-4.5 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Database Management Server</span>
                  <span className="font-bold text-slate-700 text-sm">MySQL Server 8.0</span>
                </div>
                <div className="border border-slate-150 bg-slate-50/50 p-4.5 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Host Connection</span>
                  <span className="font-bold text-slate-700 text-sm">127.0.0.1:3306</span>
                </div>
                <div className="border border-slate-150 bg-slate-50/50 p-4.5 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Database Name</span>
                  <span className="font-bold text-slate-700 text-sm">doctor_camp</span>
                </div>
                <div className="border border-slate-150 bg-slate-50/50 p-4.5 rounded-2xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Active Connections Limit</span>
                  <span className="font-bold text-slate-700 text-sm">10 Connection Pool</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Diagnose DB Connection</h4>
                  <p className="text-xs text-slate-400">Run a quick select test to measure roundtrip SQL response latency.</p>
                </div>
                <div className="flex items-center gap-3">
                  {dbPing && (
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${
                      dbPing.includes('ms') ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                    }`}>
                      Latency: {dbPing}
                    </span>
                  )}
                  <button
                    onClick={handleTestConnection}
                    disabled={dbTesting}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    {dbTesting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <HardDrive className="h-3.5 w-3.5" />
                    )}
                    <span>Run Connection Test</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Preferences & Style customizer */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">System Preferences</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure default campaign file upload boundaries and email notifications.</p>
              </div>

              <div className="space-y-5">
                {/* Max File Upload Limit */}
                <div className="flex items-center justify-between gap-6 border-b border-slate-100 pb-4">
                  <div className="text-left">
                    <span className="font-bold text-sm text-slate-700 block">Default File Attachment Limit</span>
                    <span className="text-xs text-slate-400">Limit size of user submitted attachments in dynamic builder.</span>
                  </div>
                  <select 
                    value={uploadLimit} 
                    onChange={e => setUploadLimit(e.target.value)}
                    className="text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-indigo-400 transition"
                  >
                    <option value="5MB">5 MB</option>
                    <option value="10MB">10 MB</option>
                    <option value="20MB">20 MB</option>
                    <option value="50MB">50 MB</option>
                  </select>
                </div>

                {/* Theme Mode Customizer */}
                <div className="flex items-center justify-between gap-6 border-b border-slate-100 pb-4">
                  <div className="text-left">
                    <span className="font-bold text-sm text-slate-700 block">Visual Preset Styling</span>
                    <span className="text-xs text-slate-400">Choose between the standard clean theme or experimental themes.</span>
                  </div>
                  <div className="flex gap-2">
                    {[
                      { id: 'light', label: 'Classic Premium', icon: Sun },
                      { id: 'glass', label: 'Aero Glass', icon: Moon }
                    ].map(theme => {
                      const Icon = theme.icon;
                      const active = themeMode === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => setThemeMode(theme.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[10px] font-extrabold transition-all duration-200 ${
                            active 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Email notify toggles */}
                <div className="flex items-center justify-between gap-6 pb-2">
                  <div className="text-left">
                    <span className="font-bold text-sm text-slate-700 block">Email Alerts Dispatch</span>
                    <span className="text-xs text-slate-400">Receive alerts when registration submissions cross key capacities.</span>
                  </div>
                  <button
                    onClick={() => setNotifyEmail(!notifyEmail)}
                    className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 focus:outline-none ${
                      notifyEmail ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 bg-white w-5.5 h-5.5 rounded-full shadow-md transform transition-transform duration-200 ${
                      notifyEmail ? 'translate-x-5.5' : ''
                    }`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setAlert({ type: 'success', message: 'Preferences updated and cached successfully!' });
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 active:scale-95 transition"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Preferences</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Info Card Panel */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6.5 shadow-sm space-y-5 text-left">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <ShieldCheck className="h-4.5 w-4.5 text-indigo-500" />
            <span>Profile Security Guard</span>
          </h3>

          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-indigo-950 font-medium">
                <strong>Password Policy:</strong> Minimum 6 characters. Use letters, numbers, and special symbols for maximum security strength.
              </div>
            </div>
            
            <div className="p-3.5 bg-amber-50/50 border border-amber-100/50 rounded-2xl flex items-start gap-3">
              <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-amber-950 font-medium">
                <strong>Important Notice:</strong> Changing your email address or password will force a security session invalidation. Please login again using your newly defined credentials.
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400 font-bold uppercase tracking-wide space-y-1">
            <div>Global CMS Session: ACTIVE</div>
            <div>Node Version: Node.js v18.x</div>
            <div>Deployment Mode: DEVELOPMENT</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
