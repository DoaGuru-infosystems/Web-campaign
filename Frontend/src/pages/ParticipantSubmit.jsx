import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  X, 
  AlertCircle, 
  Loader2, 
  Printer, 
  Check, 
  PenTool, 
  ShieldAlert,
  Search,
  BookOpen
} from 'lucide-react';
import api from '../utils/api';

const ParticipantSubmit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [campaign, setCampaign] = useState(null);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form values state
  const [formValues, setFormValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  
  // File uploads tracking
  const [uploadProgress, setUploadProgress] = useState({}); // { fieldName: percent }
  const [uploadingField, setUploadingField] = useState({}); // { fieldName: boolean }

  // Thank You Screen state
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [generatedRegId, setGeneratedRegId] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');

  // Signature Pad State
  const sigCanvasRefs = useRef({});
  const isDrawingRefs = useRef({});

  // Fetch campaign
  useEffect(() => {
    const fetchPublicCampaign = async () => {
      try {
        const data = await api.get(`/campaigns/public/${id}`);
        
        const today = new Date().toISOString().split('T')[0];
        const endDateStr = data.campaign.end_date ? new Date(data.campaign.end_date).toISOString().split('T')[0] : '';
        const isExpired = endDateStr && endDateStr < today;
        const isDraft = data.campaign.status === 'Draft';
        const isClosed = data.campaign.status === 'Closed' || data.campaign.isClosed;
        const isCancelled = data.campaign.status === 'Cancelled';

        if (isDraft) {
          setError('This campaign is currently in Draft mode and is not accepting registrations.');
          return;
        }
        if (isClosed || isExpired) {
          setError('This campaign has ended and is no longer accepting registrations.');
          return;
        }
        if (isCancelled) {
          setError('This campaign has been cancelled.');
          return;
        }

        setCampaign(data.campaign);
        setFields(data.fields);
        
        // Seed default values
        const defaults = {};
        data.fields.forEach(f => {
          if (f.field_type === 'Checkbox' || f.field_type === 'Multi Select') {
            defaults[f.field_name] = [];
          } else if (f.field_type === 'Yes/No Field') {
            defaults[f.field_name] = '';
          } else if (f.field_type === 'Gender') {
            defaults[f.field_name] = '';
          } else {
            defaults[f.field_name] = '';
          }
        });
        setFormValues(defaults);
      } catch (err) {
        setError(err.message || 'Campaign form not found or inactive.');
      } finally {
        setLoading(false);
      }
    };
    fetchPublicCampaign();
  }, [id]);

  // Canvas Signature pad initializers
  useEffect(() => {
    // We initialize signature pads if fields change and include Signature Upload
    fields.forEach(f => {
      if (f.field_type === 'Signature Upload' && sigCanvasRefs.current[f.field_name]) {
        initSignaturePad(f.field_name);
      }
    });
  }, [fields, submitSuccess]);

  const initSignaturePad = (fieldName) => {
    const canvas = sigCanvasRefs.current[fieldName];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Drawing mouse/touch handlers
  const handleSignatureStart = (fieldName, e) => {
    const canvas = sigCanvasRefs.current[fieldName];
    if (!canvas) return;
    isDrawingRefs.current[fieldName] = true;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSignatureDraw = (fieldName, e) => {
    if (!isDrawingRefs.current[fieldName]) return;
    const canvas = sigCanvasRefs.current[fieldName];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleSignatureEnd = (fieldName) => {
    isDrawingRefs.current[fieldName] = false;
  };

  const clearSignature = (fieldName) => {
    const canvas = sigCanvasRefs.current[fieldName];
    if (!canvas) return;
    initSignaturePad(fieldName);
    // Remove from form state
    setFormValues(prev => ({ ...prev, [fieldName]: '' }));
  };

  const saveSignature = async (fieldName) => {
    const canvas = sigCanvasRefs.current[fieldName];
    if (!canvas) return;

    setUploadingField(prev => ({ ...prev, [fieldName]: true }));
    try {
      // Convert to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `sig_${fieldName}.png`, { type: 'image/png' });
      
      const res = await api.upload(file, (percent) => {
        setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
      });

      setFormValues(prev => ({ ...prev, [fieldName]: res }));
      alert('Signature captured successfully!');
    } catch (err) {
      alert(err.message || 'Signature capture failed');
    } finally {
      setUploadingField(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  // File Change Handlers (async upload)
  const handleFileUpload = async (fieldName, e, isMultiple = false) => {
    const filesList = Array.from(e.target.files);
    if (filesList.length === 0) return;

    setUploadingField(prev => ({ ...prev, [fieldName]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));

    try {
      if (isMultiple) {
        const uploadedArr = Array.isArray(formValues[fieldName]) ? [...formValues[fieldName]] : [];
        for (let file of filesList) {
          const res = await api.upload(file, (percent) => {
            setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
          });
          uploadedArr.push(res);
        }
        setFormValues(prev => ({ ...prev, [fieldName]: uploadedArr }));
      } else {
        const file = filesList[0];
        const res = await api.upload(file, (percent) => {
          setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
        });
        setFormValues(prev => ({ ...prev, [fieldName]: res }));
      }
    } catch (err) {
      alert(err.message || 'File upload failed.');
    } finally {
      setUploadingField(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  // Remove uploaded file
  const removeUploadedFile = (fieldName, fileUrl, isMultiple = false) => {
    if (isMultiple) {
      const filtered = formValues[fieldName].filter(f => f.url !== fileUrl);
      setFormValues(prev => ({ ...prev, [fieldName]: filtered }));
    } else {
      setFormValues(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  // Multi choice change
  const handleChoiceChange = (fieldName, val, isChecked, isMultiple = false) => {
    if (isMultiple) {
      const current = Array.isArray(formValues[fieldName]) ? [...formValues[fieldName]] : [];
      if (isChecked) {
        current.push(val);
      } else {
        const index = current.indexOf(val);
        if (index > -1) current.splice(index, 1);
      }
      setFormValues(prev => ({ ...prev, [fieldName]: current }));
    } else {
      setFormValues(prev => ({ ...prev, [fieldName]: val }));
    }
  };

  // Form Submit Action
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setValidationErrors({});
    setError('');

    // Pre-validate inputs locally before hitting network
    const errors = {};
    fields.forEach(f => {
      const val = formValues[f.field_name];
      if (f.is_required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
        errors[f.field_name] = `"${f.label}" is required.`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSubmitLoading(false);
      window.scrollTo(0, 0);
      return;
    }

    try {
      const res = await api.post('/registrations', {
        campaign_id: id,
        submitted_data: formValues
      });

      setGeneratedRegId(res.registration_id);
      setThankYouMessage(res.thank_you_message);
      setSubmitSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Submission failed. Please verify credentials and sizes.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4 relative z-10" />
        <span className="text-sm font-semibold relative z-10 text-slate-650">Loading campaign form details...</span>
      </div>
    );
  }

  if (error && !submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-800 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
        <div className="max-w-md w-full bg-white/70 backdrop-blur-md border border-white/40 p-8 rounded-3xl text-center shadow-xl flex flex-col items-center space-y-4 relative z-10 transition-all duration-300">
          <ShieldAlert className="h-12 w-12 text-rose-500 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800">Campaign Inactive</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <div className="pt-4 flex w-full space-x-2">
            <button
              onClick={() => navigate('/track')}
              className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Track Submission
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success Screen
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50/50 text-slate-800 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
        <div className="max-w-xl w-full bg-white/70 backdrop-blur-md border border-white/40 p-8 rounded-3xl shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 relative z-10" id="receipt-print">
          
          <div className="flex flex-col items-center">
            <div className="bg-emerald-500 p-3 rounded-full text-white mb-4 shadow-lg shadow-emerald-500/20">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Registration Complete!</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">{thankYouMessage}</p>
          </div>

          {/* Receipt details */}
          <div className="bg-white/40 border border-white/30 p-5 rounded-2xl text-left space-y-3.5">
            <div className="flex justify-between items-center border-b border-white/20 pb-2.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Campaign Title</span>
              <span className="text-xs font-bold text-slate-700">{campaign.title}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/20 pb-2.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Registration ID</span>
              <span className="text-sm font-mono font-bold text-violet-600">{generatedRegId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Registration Date</span>
              <span className="text-xs font-semibold text-slate-650">{new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* Printable Instructions print */}
          <div className="pt-2 text-xs text-slate-400 leading-snug">
            Please copy or print your registration ticket. You can track your screening status using this ID.
          </div>

          <div className="flex items-center space-x-3 w-full border-t border-slate-100 pt-5 print:hidden">
            <button
              onClick={() => navigate('/track')}
              className="flex-1 px-4 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
            >
              Track Status
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-3 rounded-xl transition"
            >
              <Printer className="h-4 w-4" />
              <span>Print Ticket</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 relative overflow-hidden font-sans flex items-center justify-center">
      {/* Ambient glowing blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-200/50 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] right-[15%] w-[40%] h-[40%] rounded-full bg-purple-200/30 blur-[110px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl overflow-hidden relative z-10 transition-all duration-300">
        
        {/* Campaign Banner image */}
        {campaign.banner_url ? (
          <div className="h-48 w-full bg-slate-900/10 relative">
            <img src={campaign.banner_url.startsWith('/') ? `${api.BACKEND_URL}${campaign.banner_url}` : campaign.banner_url} alt={campaign.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-5 left-6 text-white space-y-1">
              <span className="text-[10px] font-bold bg-violet-600 px-2 py-0.5 rounded uppercase tracking-wider">{campaign.category}</span>
              <h1 className="text-xl font-bold tracking-tight">{campaign.title}</h1>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gradient-to-r from-violet-650 via-indigo-650 to-purple-650 text-white flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-bold bg-white/20 text-white border border-white/25 px-2 py-0.5 rounded uppercase tracking-wider">{campaign.category}</span>
              <h1 className="text-lg font-bold tracking-tight mt-1">{campaign.title}</h1>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 space-y-6">
          
          {/* Description */}
          {campaign.description && (
            <div className="bg-white/40 border border-white/30 p-4.5 rounded-2xl text-xs text-slate-650 leading-relaxed">
              {campaign.description}
            </div>
          )}

          {/* Form validation alert */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs rounded-2xl flex items-center font-semibold">
              <AlertCircle className="h-5 w-5 mr-3 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Render Fields */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map((f) => {
              const errorText = validationErrors[f.field_name];
              const isUploading = uploadingField[f.field_name];
              const progress = uploadProgress[f.field_name] || 0;
              const value = formValues[f.field_name];

              return (
                <div key={f.field_name} className="space-y-1.5 text-left">
                  <label className="block text-xs font-bold text-slate-705">
                    {f.label}
                    {f.is_required && <span className="text-rose-500 ml-1">*</span>}
                  </label>

                  {f.description && (
                    <p className="text-[10px] text-slate-400">{f.description}</p>
                  )}

                  {/* 1. Single Line Text / email / Aadhaar / PAN / URL */}
                  {['Single Line Text', 'Email', 'URL', 'Aadhaar Number', 'PAN Number'].includes(f.field_type) && (
                    <input
                      type={f.field_type === 'Email' ? 'email' : 'text'}
                      required={f.is_required}
                      placeholder={f.placeholder || 'Enter response...'}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                    />
                  )}

                  {/* 2. Numbers / Age */}
                  {['Number', 'Age'].includes(f.field_type) && (
                    <input
                      type="number"
                      required={f.is_required}
                      placeholder={f.placeholder || (f.field_type === 'Age' ? 'Age (years)' : 'Enter number...')}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full md:w-48 text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                    />
                  )}

                  {/* 3. Multi Line Text / Address */}
                  {['Multi Line Text', 'Address'].includes(f.field_type) && (
                    <textarea
                      required={f.is_required}
                      rows="3"
                      placeholder={f.placeholder || 'Enter details...'}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition resize-none"
                    />
                  )}

                  {/* 4. Date */}
                  {f.field_type === 'Date' && (
                    <input
                      type="date"
                      required={f.is_required}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full md:w-56 text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                    />
                  )}

                  {/* 5. Time */}
                  {f.field_type === 'Time' && (
                    <input
                      type="time"
                      required={f.is_required}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full md:w-40 text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                    />
                  )}

                  {/* 6. Phone Number */}
                  {f.field_type === 'Phone Number' && (
                    <input
                      type="tel"
                      required={f.is_required}
                      placeholder={f.placeholder || '+91 99999-99999'}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                    />
                  )}

                  {/* 7. Dropdown */}
                  {f.field_type === 'Dropdown' && (
                    <select
                      required={f.is_required}
                      value={value || ''}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [f.field_name]: e.target.value }))}
                      className="w-full text-xs px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                    >
                      <option value="">-- Choose Choice --</option>
                      {f.options?.map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                    </select>
                  )}

                  {/* 8. Radio Buttons */}
                  {f.field_type === 'Radio Button' && (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {f.options?.map((opt, oi) => (
                        <label key={oi} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name={f.field_name}
                            checked={value === opt}
                            onChange={() => handleChoiceChange(f.field_name, opt, true, false)}
                            className="text-violet-600 focus:ring-violet-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 9. Checkbox */}
                  {f.field_type === 'Checkbox' && (
                    <div className="flex flex-wrap gap-4 pt-1">
                      {f.options?.map((opt, oi) => (
                        <label key={oi} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(value) && value.includes(opt)}
                            onChange={(e) => handleChoiceChange(f.field_name, opt, e.target.checked, true)}
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 10. Multi Select */}
                  {f.field_type === 'Multi Select' && (
                    <div className="border border-white/30 rounded-xl p-3.5 space-y-2.5 bg-white/40 max-h-40 overflow-y-auto">
                      {f.options?.map((opt, oi) => (
                        <label key={oi} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Array.isArray(value) && value.includes(opt)}
                            onChange={(e) => handleChoiceChange(f.field_name, opt, e.target.checked, true)}
                            className="rounded text-violet-600 focus:ring-violet-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 11. Gender */}
                  {f.field_type === 'Gender' && (
                    <div className="flex items-center space-x-6 pt-1">
                      {['Male', 'Female', 'Other'].map(g => (
                        <label key={g} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name={f.field_name}
                            checked={value === g}
                            onChange={() => handleChoiceChange(f.field_name, g, true, false)}
                            className="text-violet-600 focus:ring-violet-500"
                          />
                          <span>{g}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 12. Yes/No Field */}
                  {f.field_type === 'Yes/No Field' && (
                    <div className="flex items-center space-x-6 pt-1">
                      {['Yes', 'No'].map(y => (
                        <label key={y} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name={f.field_name}
                            checked={value === y}
                            onChange={() => handleChoiceChange(f.field_name, y, true, false)}
                            className="text-violet-600 focus:ring-violet-500"
                          />
                          <span>{y}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 13. File & Document Upload fields */}
                  {['Single Image Upload', 'Single PDF Upload', 'File Upload'].includes(f.field_type) && (
                    <div className="space-y-2">
                      {value && value.url ? (
                        <div className="flex items-center justify-between bg-violet-50/40 border border-violet-100 p-3 rounded-xl">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-5 w-5 text-violet-500" />
                            <div className="text-left">
                              <span className="block text-[11px] font-bold text-slate-705 truncate max-w-[180px]">{value.originalname}</span>
                              <span className="block text-[9px] text-slate-405">{(value.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(f.field_name, value.url, false)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-violet-500 hover:bg-violet-500/5 py-6 rounded-2xl cursor-pointer transition">
                          {isUploading ? (
                            <div className="text-center space-y-2">
                              <Loader2 className="h-6 w-6 text-violet-600 animate-spin mx-auto" />
                              <span className="text-[10px] text-slate-500 font-semibold">Uploading: {progress}%</span>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                              <span className="block text-xs font-bold text-slate-600">Choose file or drag here</span>
                              <span className="block text-[9px] text-slate-400 mt-0.5">Images and PDF up to 10MB</span>
                            </div>
                          )}
                          <input
                            type="file"
                            required={f.is_required}
                            accept={f.field_type === 'Single PDF Upload' ? '.pdf' : '*'}
                            onChange={(e) => handleFileUpload(f.field_name, e, false)}
                            className="hidden"
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* 14. Multiple File uploads */}
                  {['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type) && (
                    <div className="space-y-3">
                      {value && Array.isArray(value) && value.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {value.map((fileObj, fIdx) => (
                            <div key={fileObj.url || fIdx} className="flex items-center justify-between bg-violet-50/40 border border-violet-100 p-2.5 rounded-xl">
                              <span className="text-xs truncate max-w-[150px] font-semibold text-slate-700">{fileObj.originalname}</span>
                              <button
                                type="button"
                                onClick={() => removeUploadedFile(f.field_name, fileObj.url, true)}
                                className="p-1 hover:bg-rose-500 hover:text-white text-rose-500 rounded transition"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-violet-500 hover:bg-violet-500/5 py-5 rounded-2xl cursor-pointer transition">
                        {isUploading ? (
                          <div className="text-center space-y-1">
                            <Loader2 className="h-6 w-6 text-violet-600 animate-spin mx-auto" />
                            <span className="text-[10px] text-slate-500">Uploading file... {progress}%</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                            <span className="block text-xs font-semibold text-slate-500">Upload additional file</span>
                          </div>
                        )}
                        <input
                          type="file"
                          multiple
                          onChange={(e) => handleFileUpload(f.field_name, e, true)}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  )}

                  {/* 15. Signature Drawing Pad */}
                  {f.field_type === 'Signature Upload' && (
                    <div className="space-y-3">
                      {value && value.url ? (
                        <div className="flex items-center justify-between bg-emerald-50/30 border border-emerald-200 p-2.5 rounded-xl">
                          <div className="flex items-center space-x-2">
                            <div className="h-10 w-16 bg-white border border-slate-200 rounded overflow-hidden">
                              <img src={`${api.BACKEND_URL}${value.url}`} alt="Signature" className="object-contain w-full h-full" />
                            </div>
                            <span className="text-xs font-bold text-emerald-600 flex items-center"><Check className="h-3.5 w-3.5 mr-1" /> Signature Captured</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => clearSignature(f.field_name)}
                            className="text-[10px] font-bold text-rose-600 hover:underline"
                          >
                            Redraw
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="border border-white/30 rounded-2xl overflow-hidden bg-white">
                            <canvas
                              ref={(el) => sigCanvasRefs.current[f.field_name] = el}
                              width={400}
                              height={120}
                              onMouseDown={(e) => handleSignatureStart(f.field_name, e)}
                              onMouseMove={(e) => handleSignatureDraw(f.field_name, e)}
                              onMouseUp={() => handleSignatureEnd(f.field_name)}
                              onTouchStart={(e) => handleSignatureStart(f.field_name, e)}
                              onTouchMove={(e) => handleSignatureDraw(f.field_name, e)}
                              onTouchEnd={() => handleSignatureEnd(f.field_name)}
                              className="w-full h-32 cursor-crosshair touch-none"
                            />
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 flex items-center font-medium">
                              <PenTool className="h-3.5 w-3.5 mr-1" /> Draw inside box
                            </span>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => clearSignature(f.field_name)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold rounded-lg text-slate-700 transition"
                              >
                                Clear Pad
                              </button>
                              <button
                                type="button"
                                onClick={() => saveSignature(f.field_name)}
                                disabled={isUploading}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold rounded-lg transition"
                              >
                                {isUploading ? 'Capturing...' : 'Capture Signature'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Field Specific Error text */}
                  {errorText && (
                    <span className="block text-[10px] text-rose-500 font-semibold">{errorText}</span>
                  )}
                </div>
              );
            })}

            {/* Form actions submit */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={submitLoading}
                className="w-full flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-2xl shadow-xl shadow-violet-600/10 active:scale-98 transition duration-200 disabled:opacity-50"
              >
                {submitLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span>Submit Form Registration</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default ParticipantSubmit;
