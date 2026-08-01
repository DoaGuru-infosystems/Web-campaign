import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, Search, Check, CircleDot, Menu } from 'lucide-react';
import api from '../utils/api';

const Header = ({ onSearch, onToggleSidebar }) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const dropdownRef = useRef(null);

  // Force Light Theme Only
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    localStorage.setItem('theme', 'light');
  }, []);

  // Load Notifications
  const loadNotifications = async () => {
    try {
      const data = await api.get('/analytics/notifications');
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Click outside notification dropdown to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/analytics/notifications/read');
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchVal);
    } else {
      // If we are not on a page that handles search directly, navigate to campaigns listing with search param
      navigate(`/campaigns?search=${encodeURIComponent(searchVal)}`);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="h-16 border-b border-white/40 bg-white/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 transition-all duration-200">
      
      <div className="flex items-center space-x-4 flex-1">
        {/* Hamburger Menu Toggle */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95 transition"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative w-72 md:w-80 max-w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Global search: campaigns, participants..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-violet-500 focus:outline-none text-slate-700 placeholder-slate-450 transition-all duration-200"
          />
        </form>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3.5">
        
        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setShowNotifDropdown(!showNotifDropdown);
              if (!showNotifDropdown) loadNotifications();
            }}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-650 transition-all duration-200 relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifDropdown && (
            <div className="absolute right-0 mt-3 w-80 bg-white/90 backdrop-blur-lg border border-white/40 shadow-2xl rounded-2xl overflow-hidden z-50">
              <div className="p-4 bg-slate-50/50 border-b border-white/20 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-500 flex items-center space-x-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications available.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                       key={notif.id} 
                       className={`p-4 hover:bg-slate-50/50 transition-colors duration-200 flex items-start space-x-3 ${
                         !notif.is_read ? 'bg-violet-50/20' : ''
                       }`}
                    >
                      <CircleDot className={`h-4 w-4 mt-0.5 shrink-0 ${
                        !notif.is_read ? 'text-violet-500' : 'text-slate-350'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-850 leading-normal">{notif.type}</p>
                        <p className="text-xs text-slate-605 mt-1 leading-snug">{notif.message}</p>
                        <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
