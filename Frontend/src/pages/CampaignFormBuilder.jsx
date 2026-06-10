import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Plus, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Save, 
  Settings as SettingsIcon,
  HelpCircle,
  Upload,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  Maximize2
} from 'lucide-react';
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

const fieldTypes = [
  'Single Line Text',
  'Multi Line Text',
  'Number',
  'Email',
  'Phone Number',
  'Date',
  'Time',
  'Dropdown',
  'Radio Button',
  'Checkbox',
  'Single Image Upload',
  'Multiple Image Upload',
  'Single PDF Upload',
  'Multiple PDF Upload',
  'Signature Upload',
  'Address',
  'Aadhaar Number',
  'PAN Number',
  'File Upload',
  'URL',
  'Age',
  'Gender',
  'Multi Select',
  'Yes/No Field'
];

const CampaignFormBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // If present, we are in Edit Mode
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);

  // Campaign Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('Health Camp');
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState('Draft');
  
  // Premium / Extra Settings
  const [submissionLimit, setSubmissionLimit] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('Thank you for registering! Your submission was recorded successfully.');
  const [regIdPrefix, setRegIdPrefix] = useState('CMP-2026');

  // Form Fields State
  const [fields, setFields] = useState([]);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'fields'

  // Fetch campaign if in Edit Mode
  useEffect(() => {
    if (isEditMode) {
      const fetchCampaign = async () => {
        setFetching(true);
        try {
          const res = await api.get(`/campaigns/${id}`);
          const c = res.campaign;
          
          setTitle(c.title);
          setDescription(c.description || '');
          setBannerUrl(c.banner_url || '');
          setStartDate(c.start_date ? c.start_date.split('T')[0] : '');
          setEndDate(c.end_date ? c.end_date.split('T')[0] : '');
          if (categories.includes(c.category)) {
            setCategory(c.category);
            setCustomCategory('');
          } else {
            setCategory('Other');
            setCustomCategory(c.category);
          }
          setStatus(c.status);
          setSubmissionLimit(c.submission_limit || '');
          setThankYouMessage(c.thank_you_message || '');
          setRegIdPrefix(c.registration_id_prefix || 'CMP-2026');
          
          const loadedFields = (res.fields || []).map((f, idx) => ({
            ...f,
            _key: f.id ? String(f.id) : `field_${idx}_${Date.now()}`
          }));
          setFields(loadedFields);
        } catch (err) {
          setError(err.message || 'Failed to fetch campaign details.');
        } finally {
          setFetching(false);
        }
      };
      fetchCampaign();
    } else {
      // Seed default form fields for a new campaign to help the admin start
      setFields([
        {
          _key: 'default_name',
          field_name: 'full_name',
          label: 'Full Name',
          field_type: 'Single Line Text',
          placeholder: 'Enter your full name',
          description: 'As it appears on official documents',
          is_required: true,
          validation_rules: { min_length: '3', max_length: '100' },
          options: [],
          sort_order: 0
        },
        {
          _key: 'default_email',
          field_name: 'email_address',
          label: 'Email Address',
          field_type: 'Email',
          placeholder: 'name@example.com',
          description: 'We will send details here',
          is_required: true,
          validation_rules: {},
          options: [],
          sort_order: 1
        }
      ]);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && activeTab === 'preview') {
        setActiveTab('settings');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);


  // Handle Banner Upload
  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerUploading(true);
    try {
      const data = await api.upload(file);
      setBannerUrl(data.url);
    } catch (err) {
      alert(err.message || 'Banner upload failed');
    } finally {
      setBannerUploading(false);
    }
  };

  // Add Field
  const addField = () => {
    const newIndex = fields.length;
    const newField = {
      _key: `field_${Date.now()}_${Math.random()}`,
      field_name: `custom_field_${Date.now()}`,
      label: 'Untitled Field',
      field_type: 'Single Line Text',
      placeholder: '',
      description: '',
      is_required: false,
      validation_rules: {},
      options: ['Option 1', 'Option 2'],
      sort_order: newIndex
    };
    setFields([...fields, newField]);
  };

  // Duplicate Field
  const duplicateField = (index) => {
    const original = fields[index];
    const duplicated = {
      ...original,
      _key: `field_${Date.now()}_${Math.random()}`,
      field_name: `custom_field_${Date.now()}`,
      label: `${original.label} (Copy)`,
      validation_rules: { ...original.validation_rules },
      options: original.options ? [...original.options] : [],
      sort_order: fields.length
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, duplicated);
    // Recalculate sort order
    const sorted = updated.map((f, i) => ({ ...f, sort_order: i }));
    setFields(sorted);
  };

  // Delete Field
  const deleteField = (index) => {
    const updated = fields.filter((_, i) => i !== index);
    const sorted = updated.map((f, i) => ({ ...f, sort_order: i }));
    setFields(sorted);
  };

  // Move Field Up/Down
  const moveField = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    
    // Swap
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const sorted = updated.map((f, i) => ({ ...f, sort_order: i }));
    setFields(sorted);
  };

  // Update Field Parameter
  const updateFieldParam = (index, key, val) => {
    const updated = [...fields];
    updated[index][key] = val;
    
    // Auto-update field slug key if label changes
    if (key === 'label') {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40);
      updated[index]['field_name'] = slug || `field_${index}`;
    }

    setFields(updated);
  };

  // Update Field Validation Rules
  const updateFieldValidation = (index, ruleKey, val) => {
    const updated = [...fields];
    if (!updated[index].validation_rules) {
      updated[index].validation_rules = {};
    }
    updated[index].validation_rules[ruleKey] = val;
    setFields(updated);
  };

  // Add Option (Dropdown, Radio, Checkbox, Multi Select)
  const addOption = (fieldIndex) => {
    const updated = [...fields];
    if (!updated[fieldIndex].options) {
      updated[fieldIndex].options = [];
    }
    const count = updated[fieldIndex].options.length;
    updated[fieldIndex].options.push(`Option ${count + 1}`);
    setFields(updated);
  };

  // Update Option Value
  const updateOptionValue = (fieldIndex, optionIndex, val) => {
    const updated = [...fields];
    updated[fieldIndex].options[optionIndex] = val;
    setFields(updated);
  };

  // Remove Option
  const removeOption = (fieldIndex, optionIndex) => {
    const updated = [...fields];
    updated[fieldIndex].options = updated[fieldIndex].options.filter((_, i) => i !== optionIndex);
    setFields(updated);
  };

  // Submit / Save Campaign
  const handleSaveCampaign = async () => {
    const finalCategory = category === 'Other' ? customCategory.trim() : category;

    if (!title || !startDate || !endDate || !finalCategory) {
      setError('Please fill in all basic campaign information.');
      return;
    }

    if (category === 'Other' && !customCategory.trim()) {
      setError('Please specify the custom category name.');
      return;
    }

    if (fields.length === 0) {
      setError('Please add at least one field to your dynamic registration form.');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      title,
      description,
      banner_url: bannerUrl,
      start_date: startDate,
      end_date: endDate,
      category: finalCategory,
      status,
      submission_limit: submissionLimit ? parseInt(submissionLimit) : null,
      thank_you_message: thankYouMessage,
      registration_id_prefix: regIdPrefix,
      fields
    };

    try {
      if (isEditMode) {
        await api.put(`/campaigns/${id}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }
      navigate('/campaigns');
    } catch (err) {
      setError(err.message || 'Failed to save campaign. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[80vh] text-slate-500 bg-slate-50/50">
        <Loader2 className="w-10 h-10 text-violet-600 animate-spin mb-3" />
        <span className="text-sm font-bold text-slate-600">Loading campaign schema...</span>
      </div>
    );
  }

  const renderLivePreviewContent = () => {
    return (
      <div className="w-full bg-white/60 backdrop-blur-md border border-white/40 shadow-xl rounded-2xl overflow-hidden flex flex-col mx-auto">
        {/* Chrome Browser Header mock */}
        <div className="bg-white/40 border-b border-white/20 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400 block" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 block" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 block" />
          </div>
          <div className="w-1/2 bg-white/80 border border-white/30 text-[9px] text-slate-500 rounded-md text-center py-0.5 truncate select-none shadow-xs flex items-center justify-center space-x-1 px-2 font-medium">
            <span className="text-slate-355">https://</span>
            <span>campflow.live/campaign/{id || 'preview'}</span>
          </div>
          <div className="w-6 shrink-0" />
        </div>

        {/* Scrollable page body */}
        <div className="p-5 space-y-5 text-left max-h-[55vh] overflow-y-auto bg-transparent no-scrollbar">
          {/* Banner preview */}
          {bannerUrl ? (
            <div className="rounded-xl overflow-hidden h-24 w-full bg-slate-900 shadow-inner">
              <img src={bannerUrl.startsWith('/') ? `${api.BACKEND_URL}${bannerUrl}` : bannerUrl} alt="Banner Preview" className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 h-16 w-full flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 italic">
              Configure a banner to preview here
            </div>
          )}

          {/* Campaign title/headers */}
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 leading-snug tracking-tight">
              {title || 'Untitled Campaign'}
            </h3>
            <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
              {description || 'Provide a description to display dynamic details to your campaign attendees.'}
            </p>
            
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-650">
                {category === 'Other' ? (customCategory || 'Other') : category}
              </span>
              {startDate && endDate && (
                <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {startDate} to {endDate}
                </span>
              )}
            </div>
          </div>

          {/* Form fields rendering */}
          <form className="space-y-4 pt-3.5 border-t border-slate-100" onSubmit={(e) => e.preventDefault()}>
            {fields.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-6">Your dynamic field widgets will appear here...</p>
            ) : (
              fields.map((f, index) => {
                return (
                  <div key={index} className="space-y-1.5 text-left">
                    <label className="block text-[10px] font-bold text-slate-700">
                      {f.label || 'Untitled Field'}
                      {f.is_required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    
                    {f.description && (
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{f.description}</p>
                    )}

                    {/* Specific UI Shapes */}
                    {['Single Line Text', 'Email', 'URL', 'Aadhaar Number', 'PAN Number'].includes(f.field_type) && (
                      <input
                        type="text"
                        disabled
                        placeholder={f.placeholder || 'Enter response...'}
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Number' && (
                      <input
                        type="number"
                        disabled
                        placeholder={f.placeholder || 'Enter value...'}
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Age' && (
                      <input
                        type="number"
                        disabled
                        placeholder="Age"
                        className="w-20 text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Gender' && (
                      <div className="flex items-center space-x-3">
                        {['Male', 'Female', 'Other'].map(g => (
                          <label key={g} className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <input type="radio" disabled className="text-slate-350" />
                            <span>{g}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {f.field_type === 'Multi Line Text' && (
                      <textarea
                        disabled
                        rows="2"
                        placeholder={f.placeholder || 'Write response...'}
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400 resize-none"
                      />
                    )}

                    {f.field_type === 'Phone Number' && (
                      <input
                        type="tel"
                        disabled
                        placeholder={f.placeholder || '+91 99999-99999'}
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Date' && (
                      <input
                        type="date"
                        disabled
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Time' && (
                      <input
                        type="time"
                        disabled
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400"
                      />
                    )}

                    {f.field_type === 'Dropdown' && (
                      <select disabled className="w-full text-[11px] px-2.5 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400">
                        {f.options?.map((opt, oi) => <option key={oi}>{opt}</option>)}
                      </select>
                    )}

                    {f.field_type === 'Radio Button' && (
                      <div className="flex flex-wrap gap-2">
                        {f.options?.map((opt, oi) => (
                          <label key={oi} className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <input type="radio" disabled />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {f.field_type === 'Checkbox' && (
                      <div className="flex flex-wrap gap-2">
                        {f.options?.map((opt, oi) => (
                          <label key={oi} className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <input type="checkbox" disabled />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {f.field_type === 'Multi Select' && (
                      <div className="border border-slate-155 rounded-xl p-2 bg-slate-50/50 space-y-1">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Multi Choices:</p>
                        {f.options?.map((opt, oi) => (
                          <label key={oi} className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                            <input type="checkbox" disabled />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {f.field_type === 'Yes/No Field' && (
                      <div className="flex items-center space-x-3">
                        {['Yes', 'No'].map(y => (
                          <label key={y} className="flex items-center space-x-1 text-[10px] text-slate-500">
                            <input type="radio" disabled />
                            <span>{y}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {['Single Image Upload', 'Multiple Image Upload', 'Single PDF Upload', 'Multiple PDF Upload', 'File Upload'].includes(f.field_type) && (
                      <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center bg-slate-55">
                        <Upload className="h-4 w-4 mx-auto text-slate-400 mb-0.5" />
                        <span className="text-[9px] text-slate-405 block">{f.field_type}</span>
                      </div>
                    )}

                    {f.field_type === 'Signature Upload' && (
                      <div className="border border-slate-200 rounded-xl h-16 bg-slate-50 flex items-center justify-center">
                        <span className="text-[9px] text-slate-400 italic">Signature Pad</span>
                      </div>
                    )}

                    {f.field_type === 'Address' && (
                      <textarea
                        disabled
                        rows="2"
                        placeholder="House, Street, Area, City, State..."
                        className="w-full text-[11px] px-3 py-2 rounded-xl bg-slate-50/50 border border-slate-200 text-slate-400 resize-none"
                      />
                    )}
                  </div>
                );
              })
            )}

            <button
              type="button"
              disabled
              className="w-full bg-violet-600/80 text-white font-bold py-2.5 rounded-xl text-xs mt-4"
            >
              Submit Registration
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-white">
      
      {/* Dynamic Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 px-6 py-3.5 bg-white shrink-0 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-violet-655 bg-violet-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {isEditMode ? 'Edit Mode' : 'Draft Studio'}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-bold truncate max-w-[200px]">
              {title || 'New Campaign'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight mt-0.5">
            {isEditMode ? 'Edit Campaign Form' : 'Design Campaign Form'}
          </h2>
        </div>
        
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => navigate('/campaigns')}
            className="px-4 py-2 border border-slate-250/70 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-97"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveCampaign}
            disabled={loading}
            className="flex items-center justify-center space-x-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md shadow-violet-600/10 active:scale-97 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isEditMode ? 'Save Changes' : 'Publish Campaign'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-150 text-rose-700 text-xs rounded-xl flex items-center font-semibold shrink-0">
          <AlertCircle className="h-4 w-4 mr-2.5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2-COLUMN WORKSPACE: Tabbed settings/editor on left, Live Canvas on right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 min-h-0 overflow-hidden">
        
        {/* LEFT PANEL: Switchable Settings & Fields Editor (width: lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col min-h-0 bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Header Switcher */}
          <div className="p-3 border-b border-white/20 bg-white/20 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition duration-150 whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <SettingsIcon className="h-3.5 w-3.5 text-violet-500" />
                <span>1. Settings</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fields')}
                className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-lg text-xs font-bold transition duration-150 whitespace-nowrap ${
                  activeTab === 'fields'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-violet-500" />
                <span>2. Fields ({fields.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex lg:hidden items-center space-x-2 px-3 py-2 rounded-lg text-xs font-bold transition duration-150 whitespace-nowrap ${
                  activeTab === 'preview'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Eye className="h-3.5 w-3.5 text-violet-500" />
                <span>3. Live Preview</span>
              </button>
            </div>

            {/* Header Right Action (Add Field directly if on fields tab) */}
            {activeTab === 'fields' && (
              <button
                type="button"
                onClick={addField}
                className="flex items-center space-x-1 text-xs text-violet-750 font-bold bg-violet-50 hover:bg-violet-100/80 px-3 py-1.5 rounded-xl transition duration-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Field</span>
              </button>
            )}
          </div>

          {/* Active Tab Panel Container */}
          <div className="flex-1 overflow-y-auto p-5 no-scrollbar bg-transparent">
            {activeTab === 'settings' ? (
              // -------------------------------------------------------------
              // TAB 1: CAMPAIGN CONFIGURATION (Clean form blocks)
              // -------------------------------------------------------------
              <div className="space-y-5 max-w-3xl mx-auto">
                {/* Section 1: General Information */}
                <div className="bg-white/40 border border-white/20 p-5 rounded-2xl shadow-2xs space-y-4">
                  <h4 className="text-[10px] font-extrabold text-violet-600 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center space-x-1.5">
                    <span>General Campaign Info</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Campaign Title *</label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Health Camp 2026"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="3"
                        placeholder="Provide details about the campaign's goals, location, and key instructions..."
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category *</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {category === 'Other' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Custom Category Name *</label>
                        <input
                          type="text"
                          required
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="e.g. Dental Camp"
                          className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status *</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Duration & Branding */}
                <div className="bg-white/40 border border-white/20 p-5 rounded-2xl shadow-2xs space-y-4">
                  <h4 className="text-[10px] font-extrabold text-violet-600 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Branding & Dates
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date *</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date *</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Banner Image</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          placeholder="Paste image URL or upload file..."
                          className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 transition"
                        />
                        <label className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 cursor-pointer border border-slate-200 transition flex items-center shrink-0">
                          {bannerUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-violet-600 mr-1.5" />
                          ) : (
                            <Upload className="h-4 w-4 mr-1.5" />
                          )}
                          <span>Upload File</span>
                          <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                        </label>
                      </div>
                      {bannerUrl && (
                        <div className="mt-3.5 relative rounded-2xl overflow-hidden border border-slate-200 h-28 w-full bg-slate-900 flex items-center justify-center">
                          <img src={bannerUrl.startsWith('/') ? `${api.BACKEND_URL}${bannerUrl}` : bannerUrl} alt="Banner Preview" className="object-cover w-full h-full" />
                          <button onClick={() => setBannerUrl('')} className="absolute top-2.5 right-2.5 bg-slate-950/70 hover:bg-rose-600 p-1.5 rounded-lg text-white transition-all shadow-md">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: Extra settings */}
                <div className="bg-white/40 border border-white/20 p-5 rounded-2xl shadow-2xs space-y-4">
                  <h4 className="text-[10px] font-extrabold text-violet-600 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Limits & Confirmation Messages
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Registration ID Prefix *</label>
                      <input
                        type="text"
                        required
                        value={regIdPrefix}
                        onChange={(e) => setRegIdPrefix(e.target.value)}
                        placeholder="e.g. CAMP"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max Registrations Limit</label>
                      <input
                        type="number"
                        value={submissionLimit}
                        onChange={(e) => setSubmissionLimit(e.target.value)}
                        placeholder="Leave blank for unlimited"
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thank You Success Message</label>
                      <textarea
                        value={thankYouMessage}
                        onChange={(e) => setThankYouMessage(e.target.value)}
                        rows="3"
                        placeholder="Confirmation message displayed on successful registration..."
                        className="w-full text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'fields' ? (
              // -------------------------------------------------------------
              // TAB 2: DYNAMIC FIELDS EDITOR (Wider fields display)
              // -------------------------------------------------------------
              <div className="space-y-4 max-w-4xl mx-auto">
                {fields.length === 0 ? (
                  <div className="text-center py-16 bg-white/40 border border-white/20 rounded-2xl">
                    <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2.5 stroke-1" />
                    <p className="text-xs text-slate-500 font-semibold">No fields configured yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Click the "Add Field" button to build your custom form structure.</p>
                  </div>
                ) : (
                  fields.map((field, fIndex) => (
                    <div 
                      key={field._key || field.id || fIndex} 
                      className="bg-white/50 border border-white/30 p-5 rounded-xl shadow-xs space-y-4 relative group hover:border-violet-300 transition-colors"
                    >
                      {/* Card Toolbar */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-150 px-2 py-0.5 rounded-md">
                            Field {fIndex + 1}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]">
                            {field.field_name}
                          </span>
                        </div>
                        
                        {/* Action controls */}
                        <div className="flex items-center space-x-1">
                          <button onClick={() => moveField(fIndex, 'up')} disabled={fIndex === 0} title="Move Up" className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg transition">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveField(fIndex, 'down')} disabled={fIndex === fields.length - 1} title="Move Down" className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg transition">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => duplicateField(fIndex)} title="Duplicate Field" className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteField(fIndex)} title="Delete Field" className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Form Parameters */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Field Label *</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateFieldParam(fIndex, 'label', e.target.value)}
                            placeholder="e.g. Full Name"
                            className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Field Type *</label>
                          <select
                            value={field.field_type}
                            onChange={(e) => updateFieldParam(fIndex, 'field_type', e.target.value)}
                            className="w-full text-xs px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 transition"
                          >
                            {fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateFieldParam(fIndex, 'placeholder', e.target.value)}
                            placeholder="e.g. Enter details..."
                            className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Description (Helper Subtext)</label>
                          <input
                            type="text"
                            value={field.description || ''}
                            onChange={(e) => updateFieldParam(fIndex, 'description', e.target.value)}
                            placeholder="Optional instructions..."
                            className="w-full text-xs px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                          />
                        </div>
                      </div>

                      {/* Dropdown / Selection configuration options */}
                      {['Dropdown', 'Radio Button', 'Checkbox', 'Multi Select'].includes(field.field_type) && (
                        <div className="p-4 bg-white/40 border border-white/20 rounded-xl space-y-3 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider">Choices Configuration</span>
                            <button
                              type="button"
                              onClick={() => addOption(fIndex)}
                              className="flex items-center space-x-1 text-[10px] text-violet-600 hover:text-violet-500 font-bold transition"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Option</span>
                            </button>
                          </div>

                          {!field.options || field.options.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">No options defined. Add at least one.</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {field.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center space-x-1.5 bg-white border border-slate-150 pl-2 pr-1 py-1 rounded-lg">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => updateOptionValue(fIndex, oIndex, e.target.value)}
                                    className="flex-1 text-[10px] bg-transparent focus:outline-none text-slate-700 font-semibold border-none"
                                  />
                                  <button
                                    onClick={() => removeOption(fIndex, oIndex)}
                                    className="p-0.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Validation details */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-slate-100 pt-3">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.is_required || false}
                            onChange={(e) => updateFieldParam(fIndex, 'is_required', e.target.checked)}
                            className="rounded text-violet-600 border-slate-350 focus:ring-violet-500 h-3.5 w-3.5"
                          />
                          <span className="text-[10px] font-bold text-slate-600">Required Field</span>
                        </label>

                        {/* Range validation rules */}
                        {['Number', 'Age'].includes(field.field_type) && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-slate-500">Range Limits:</span>
                            <input
                              type="number"
                              value={field.validation_rules?.min_value || ''}
                              onChange={(e) => updateFieldValidation(fIndex, 'min_value', e.target.value)}
                              placeholder="Min Value"
                              className="w-20 text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50"
                            />
                            <span className="text-[9px] text-slate-400">to</span>
                            <input
                              type="number"
                              value={field.validation_rules?.max_value || ''}
                              onChange={(e) => updateFieldValidation(fIndex, 'max_value', e.target.value)}
                              placeholder="Max Value"
                              className="w-20 text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50"
                            />
                          </div>
                        )}

                        {/* Length validation rules */}
                        {['Single Line Text', 'Multi Line Text'].includes(field.field_type) && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-slate-500">Char Limits:</span>
                            <input
                              type="number"
                              value={field.validation_rules?.min_length || ''}
                              onChange={(e) => updateFieldValidation(fIndex, 'min_length', e.target.value)}
                              placeholder="Min Len"
                              className="w-16 text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50"
                            />
                            <span className="text-[9px] text-slate-400">to</span>
                            <input
                              type="number"
                              value={field.validation_rules?.max_length || ''}
                              onChange={(e) => updateFieldValidation(fIndex, 'max_length', e.target.value)}
                              placeholder="Max Len"
                              className="w-16 text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50"
                            />
                          </div>
                        )}

                        {/* File upload validation rules */}
                        {['Single Image Upload', 'Multiple Image Upload', 'Single PDF Upload', 'Multiple PDF Upload', 'Signature Upload', 'File Upload'].includes(field.field_type) && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold text-slate-500">Max File Size:</span>
                            <select
                              value={field.validation_rules?.file_size_limit || '10'}
                              onChange={(e) => updateFieldValidation(fIndex, 'file_size_limit', e.target.value)}
                              className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 text-slate-700 bg-slate-50"
                            >
                              <option value="1">1 MB</option>
                              <option value="2">2 MB</option>
                              <option value="5">5 MB</option>
                              <option value="10">10 MB</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={addField}
                  className="w-full flex items-center justify-center space-x-1.5 border border-dashed border-slate-300 hover:border-violet-500 hover:bg-violet-50/20 py-4 rounded-xl text-xs font-bold text-slate-500 hover:text-violet-600 transition duration-200"
                >
                  <Plus className="h-4.5 w-4.5" />
                  <span>Add Custom Field</span>
                </button>
              </div>
            ) : (
              // -------------------------------------------------------------
              // TAB 3: LIVE PREVIEW (Mobile Only)
              // -------------------------------------------------------------
              <div className="max-w-md mx-auto py-2">
                {renderLivePreviewContent()}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Live Interactive Form Preview (width: lg:col-span-4) */}
        <div className="hidden lg:flex lg:col-span-4 flex-col min-h-0 bg-white/70 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-white/20 bg-white/20 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Eye className="h-3.5 w-3.5 text-violet-500" />
              <span>3. Live Device Canvas</span>
            </h3>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Responsive
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-transparent no-scrollbar">
            {renderLivePreviewContent()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CampaignFormBuilder;
