import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Lock, 
  ShieldAlert, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import api from '../utils/api';

const Employees = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerLoading, setRegisterLoading] = useState(false);
  
  // Registration Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status/Alert
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: '' }

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/employees');
      setEmployees(res.employees || []);
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: err.message || 'Failed to retrieve employees list.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    }
  }, [isAdmin]);

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();
    setAlert(null);
    setRegisterLoading(true);

    try {
      await api.post('/auth/register-employee', { name, email, password });
      setAlert({ type: 'success', message: 'Employee registered successfully!' });
      
      // Clear form fields
      setName('');
      setEmail('');
      setPassword('');
      
      // Refresh list
      fetchEmployees();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to register employee.' });
    } finally {
      setRegisterLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[75vh]">
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-8 rounded-3xl shadow-xl max-w-md text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Access Restricted</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Only administrators are authorized to manage employees and credentials. Please contact support if you require privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Employee Registry</h2>
          <p className="text-sm text-slate-500 font-medium">Add, review, and manage campaign staff and login credentials</p>
        </div>
        <div className="flex items-center space-x-2 bg-violet-550/10 text-violet-750 px-4 py-2 rounded-xl border border-violet-100 text-xs font-bold shrink-0">
          <Users className="w-4 h-4 mr-1 text-violet-650" />
          <span>Total Staff: {employees.length}</span>
        </div>
      </div>

      {alert && (
        <div className={`p-4 rounded-2xl flex items-center space-x-3 text-xs font-medium border ${
          alert.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
            : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          )}
          <span>{alert.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Registration Form Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 p-6 rounded-3xl shadow-sm h-fit space-y-5 lg:col-span-1">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <div className="bg-violet-600 p-2 rounded-lg text-white">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-805 text-sm">Register Employee</h3>
          </div>

          <form onSubmit={handleRegisterEmployee} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul.sharma@example.com"
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-450 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={registerLoading}
              className="w-full flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-violet-600/10 active:scale-98 transition disabled:opacity-50 text-xs"
            >
              {registerLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Employees Table Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl shadow-sm overflow-hidden lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="p-6 border-b border-slate-100 flex items-center space-x-2">
            <Users className="w-4.5 h-4.5 text-violet-600" />
            <h3 className="font-bold text-slate-805 text-sm">Registered Staff Accounts</h3>
          </div>

          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center py-24 text-slate-500 font-semibold">
                <Loader2 className="w-8 h-8 text-violet-600 animate-spin mr-3" />
                <span className="text-xs">Loading employees...</span>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Users className="w-12 h-12 text-slate-350 stroke-1 mb-2" />
                <span className="text-xs font-semibold">No employees registered yet.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100/80 text-slate-500 uppercase tracking-wider font-extrabold text-[9px]">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-55/30 transition">
                      <td className="px-6 py-4 font-bold text-slate-800">{emp.name}</td>
                      <td className="px-6 py-4 text-slate-500">{emp.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-violet-50 text-violet-700 border border-violet-100">
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Employees;
