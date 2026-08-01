import React, { useState, useEffect } from 'react';
import { User, Database } from 'lucide-react';

const Settings = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      setUser(JSON.parse(raw));
    }
  }, []);

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Settings</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">Configure administrative permissions, profiles, database information, and defaults</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        {/* Profile Details */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <User className="h-4.5 w-4.5 text-violet-500" />
            <span>Administrator Profile</span>
          </h3>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold">Email Address</span>
              <span className="font-semibold text-slate-700">{user?.email || 'admin@campaignflow.com'}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold">System Role</span>
              <span className="font-semibold text-slate-700">{user?.role || 'Super Admin'}</span>
            </div>
          </div>
        </div>

        {/* Database Connection Metadata */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <Database className="h-4.5 w-4.5 text-emerald-500" />
            <span>Database Connections</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold">Relational DB</span>
              <span className="font-semibold text-slate-700">MySQL (doctor_camp)</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold">Active Pool Size</span>
              <span className="font-semibold text-slate-700">10 connections</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
