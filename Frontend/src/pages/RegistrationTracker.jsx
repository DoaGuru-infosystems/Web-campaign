import React, { useState } from 'react';
import { Search, Loader2, ArrowLeft, Calendar, FileText, CheckCircle, Clock, XCircle, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const RegistrationTracker = () => {
  const navigate = useNavigate();
  const [regId, setRegId] = useState('');
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!regId) return;

    setLoading(true);
    setError('');
    setRecord(null);

    try {
      const data = await api.get(`/registrations/track/${regId.trim()}`);
      setRecord(data.registration);
    } catch (err) {
      setError(err.message || 'No active registration record matches this ID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Ambient glowing blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] right-[15%] w-[40%] h-[40%] rounded-full bg-purple-200/30 blur-[110px] pointer-events-none" />

      <div className="w-full max-w-xl bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6.5 shadow-2xl relative z-10 space-y-6">
        
        {/* Header branding */}
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Track Registration Status</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">Enter your Registration ID to monitor the status of your campaign screening</p>
        </div>

        {/* Form Search input */}
        <form onSubmit={handleTrack} className="space-y-4 print:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              required
              value={regId}
              onChange={(e) => setRegId(e.target.value)}
              placeholder="e.g. CMP-2026-XXXX"
              className="w-full text-sm pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-2xl shadow-lg active:scale-98 transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span>Retrieve Record</span>
            )}
          </button>
        </form>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/35 text-rose-600 text-xs rounded-2xl flex items-center font-medium print:hidden">
            <XCircle className="h-5 w-5 mr-3 text-rose-550 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Record Details and timelines */}
        {record && (
          <div className="space-y-5 border-t border-slate-100 pt-5 text-left animate-in fade-in slide-in-from-bottom-2 duration-350">
            
            {/* Visual Step status line */}
            <div className="py-4 flex items-center justify-between w-full max-w-md mx-auto">
              
              {/* Step 1: Received */}
              <div className="flex flex-col items-center flex-1 relative">
                <div className="h-8.5 w-8.5 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold z-10 shadow-md">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1.5">Submitted</span>
                <div className="absolute top-4 left-1/2 w-full h-0.5 bg-slate-200 -z-0" />
              </div>

              {/* Step 2: Screened/Verified */}
              <div className="flex flex-col items-center flex-1 relative">
                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-md ${
                  record.status === 'Verified' || record.status === 'Approved'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {record.status === 'Verified' || record.status === 'Approved' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1.5">Screened</span>
                <div className="absolute top-4 left-1/2 w-full h-0.5 bg-slate-200 -z-0" />
              </div>

              {/* Step 3: Approved/Rejected outcomes */}
              <div className="flex flex-col items-center flex-1">
                <div className={`h-8.5 w-8.5 rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-md ${
                  record.status === 'Approved'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : record.status === 'Rejected'
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {record.status === 'Approved' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : record.status === 'Rejected' ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-700 mt-1.5">
                  {record.status === 'Rejected' ? 'Rejected' : 'Approved'}
                </span>
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-white/40 border border-white/30 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Registration ID</span>
                <span className="text-xs font-bold font-mono text-violet-600">{record.registration_id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Campaign Title</span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{record.campaign_title}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Submitted Date</span>
                <span className="text-xs font-semibold text-slate-650">{new Date(record.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Status Statement</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  record.status === 'Approved' || record.status === 'Verified'
                    ? 'bg-emerald-50 text-emerald-600'
                    : record.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-amber-50 text-amber-600'
                }`}>
                  {record.status}
                </span>
              </div>
            </div>

            {/* Print/Save Ticket buttons */}
            <div className="flex items-center space-x-3 pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Ticket</span>
              </button>
            </div>

          </div>
        )}

        {/* Help footer */}
        <div className="pt-2 text-center print:hidden">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center space-x-1.5 text-xs text-slate-400 hover:text-slate-605 font-bold mx-auto transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default RegistrationTracker;
