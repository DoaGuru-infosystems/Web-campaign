import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Layers, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  Megaphone,
  UserCheck,
  X
} from 'lucide-react';
import api from '../utils/api';

const Sidebar = ({ adminName, isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Create Campaign', path: '/campaign/create', icon: PlusCircle },
    { name: 'View Campaigns', path: '/campaigns', icon: Layers },
    { name: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside className={`w-56 bg-white/20 backdrop-blur-xl text-slate-800 flex flex-col min-h-screen border-r border-white/20 transition-all duration-300 z-50 fixed inset-y-0 left-0 lg:static lg:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="bg-violet-600 p-1.5 rounded-lg text-white shadow-md shadow-violet-600/10">
            <Megaphone className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm leading-tight tracking-tight text-slate-900">CampaignFlow</h1>
            <span className="text-[8px] text-violet-600 font-bold uppercase tracking-wider block">Enterprise CMS</span>
          </div>
        </div>

        {/* Mobile close button */}
        <button 
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg hover:bg-slate-100/50 text-slate-550 hover:text-slate-900 transition"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) => 
                `flex items-center space-x-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 group text-xs font-semibold ${
                  isActive 
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/15' 
                    : 'text-slate-650 hover:bg-white/40 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Profile & Logout */}
      <div className="p-3 border-t border-white/10 bg-slate-50/10">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-slate-100/50 flex items-center justify-center text-violet-650 border border-white/20 shrink-0">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[11px] font-bold text-slate-800 truncate">{adminName || 'Admin User'}</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Administrator</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-200/50 hover:border-rose-200 hover:bg-rose-50 text-slate-550 hover:text-rose-600 text-[10px] font-bold transition-all duration-200"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
