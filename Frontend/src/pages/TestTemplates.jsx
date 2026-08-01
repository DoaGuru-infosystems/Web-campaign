import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Save, 
  Activity, 
  Check, 
  Loader2, 
  CheckSquare, 
  Square,
  PlusCircle,
  FolderOpen,
  Edit3
} from 'lucide-react';
import api from '../utils/api';

const TestTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);

  // Builder form state
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedVitals, setSelectedVitals] = useState({
    bp: true,
    pulse: true,
    temp: true,
    spo2: true,
    weight: true,
    height: true
  });

  // Grids state
  const [grids, setGrids] = useState([
    { name: 'Cataract / Glaucoma Screening', columns: ['RE', 'LE'], rows: ['Lid', 'Conjunctiva', 'Cornea', 'Lens', 'Fundus'] }
  ]);

  // Dropdowns state
  const [dropdowns, setDropdowns] = useState([
    { name: 'Visual Acuity', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'PL/PR', 'No PL'] }
  ]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/test-templates');
      setTemplates(res.templates || []);
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to load test templates.');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const toggleVital = (vital) => {
    setSelectedVitals(prev => ({
      ...prev,
      [vital]: !prev[vital]
    }));
  };

  // Grid management
  const addGrid = () => {
    setGrids(prev => [...prev, { name: '', columns: ['RE', 'LE'], rows: [] }]);
  };

  const updateGridName = (index, name) => {
    setGrids(prev => {
      const copy = [...prev];
      copy[index].name = name;
      return copy;
    });
  };

  const updateGridColumns = (index, colsString) => {
    setGrids(prev => {
      const copy = [...prev];
      copy[index].columns = colsString.split(',').map(s => s.trim()).filter(Boolean);
      return copy;
    });
  };

  const updateGridRows = (index, rowsString) => {
    setGrids(prev => {
      const copy = [...prev];
      copy[index].rows = rowsString.split(',').map(s => s.trim()).filter(Boolean);
      return copy;
    });
  };

  const removeGrid = (index) => {
    setGrids(prev => prev.filter((_, i) => i !== index));
  };

  // Dropdown management
  const addDropdown = () => {
    setDropdowns(prev => [...prev, { name: '', options: [] }]);
  };

  const updateDropdownName = (index, name) => {
    setDropdowns(prev => {
      const copy = [...prev];
      copy[index].name = name;
      return copy;
    });
  };

  const updateDropdownOptions = (index, optionsString) => {
    setDropdowns(prev => {
      const copy = [...prev];
      copy[index].options = optionsString.split(',').map(s => s.trim()).filter(Boolean);
      return copy;
    });
  };

  const removeDropdown = (index) => {
    setDropdowns(prev => prev.filter((_, i) => i !== index));
  };

  // Save template
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showAlert('error', 'Please enter a template title.');
      return;
    }

    const vitalsArray = Object.keys(selectedVitals).filter(k => selectedVitals[k]);
    
    // Validate grids and dropdowns
    const filteredGrids = grids.filter(g => g.name.trim() !== '');
    const filteredDropdowns = dropdowns.filter(d => d.name.trim() !== '');

    const payload = {
      title,
      vitals: vitalsArray,
      questions: {
        grids: filteredGrids,
        dropdowns: filteredDropdowns
      }
    };

    setSaving(true);
    try {
      if (editingTemplateId) {
        await api.put(`/test-templates/${editingTemplateId}`, payload);
        showAlert('success', 'Diagnostic template updated successfully!');
      } else {
        await api.post('/test-templates', payload);
        showAlert('success', 'Diagnostic template created successfully!');
      }
      setTitle('');
      setGrids([{ name: 'Cataract / Glaucoma Screening', columns: ['RE', 'LE'], rows: ['Lid', 'Conjunctiva', 'Cornea', 'Lens', 'Fundus'] }]);
      setDropdowns([{ name: 'Visual Acuity', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'PL/PR', 'No PL'] }]);
      setSelectedVitals({ bp: true, pulse: true, temp: true, spo2: true, weight: true, height: true });
      setEditingTemplateId(null);
      setIsCreating(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template? Campaigns using this template will fallback to standard vitals.')) {
      return;
    }

    try {
      await api.delete(`/test-templates/${id}`);
      showAlert('success', 'Template deleted successfully.');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      showAlert('error', err.message || 'Failed to delete template.');
    }
  };

  const handleStartEdit = (template) => {
    setEditingTemplateId(template.id);
    setTitle(template.title || '');
    
    // Vitals mapping
    const vitalsObj = { bp: false, pulse: false, temp: false, spo2: false, weight: false, height: false };
    (template.vitals || []).forEach(v => {
      vitalsObj[v] = true;
    });
    setSelectedVitals(vitalsObj);

    // Grids mapping
    if (Array.isArray(template.questions?.grids)) {
      setGrids(template.questions.grids);
    } else if (template.questions?.grid) {
      setGrids([{
        name: template.questions.grid.name || 'Clinical Examination',
        columns: template.questions.grid.columns || [],
        rows: template.questions.grid.rows || [],
      }]);
    } else {
      setGrids([]);
    }

    // Dropdowns mapping
    if (Array.isArray(template.questions?.dropdowns)) {
      setDropdowns(template.questions.dropdowns);
    } else if (Array.isArray(template.questions?.selects)) {
      setDropdowns(template.questions.selects.map(s => ({
        name: s.label,
        options: s.options || [],
      })));
    } else {
      setDropdowns([]);
    }

    setIsCreating(true);
  };

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Diagnostic Test Templates</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Create and configure dynamic test forms for mobile healthcare testing camps.</p>
        </div>
        <button
          onClick={() => {
            if (isCreating) {
              setTitle('');
              setGrids([{ name: 'Cataract / Glaucoma Screening', columns: ['RE', 'LE'], rows: ['Lid', 'Conjunctiva', 'Cornea', 'Lens', 'Fundus'] }]);
              setDropdowns([{ name: 'Visual Acuity', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60', 'PL/PR', 'No PL'] }]);
              setSelectedVitals({ bp: true, pulse: true, temp: true, spo2: true, weight: true, height: true });
              setEditingTemplateId(null);
              setIsCreating(false);
            } else {
              setIsCreating(true);
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-600/10 active:scale-95 transition"
        >
          {isCreating ? (editingTemplateId ? 'Cancel Edit & View List' : 'View Templates List') : 'Create New Template'}
        </button>
      </div>

      {/* Alert banner */}
      {alert && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${
          alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {alert.message}
        </div>
      )}

      {isCreating ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Builder Form */}
          <form onSubmit={handleSave} className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6 shadow-sm space-y-6 text-left">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Template Details</h3>
              <p className="text-xs text-slate-400 mt-0.5">Give your test format a name and customize its components.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 block">Template Title</label>
              <input 
                type="text" 
                required
                value={title} 
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Comprehensive Vision & Health Screening"
                className="w-full text-xs px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-violet-400 focus:bg-white transition"
              />
            </div>

            {/* Vitals Selection */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-700">Patient Vitals Checklist</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Choose which patient vitals the employee should collect.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.keys(selectedVitals).map((vital) => (
                  <button
                    key={vital}
                    type="button"
                    onClick={() => toggleVital(vital)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                      selectedVitals[vital] 
                        ? 'bg-violet-50/50 border-violet-200 text-violet-700' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {selectedVitals[vital] ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    <span className="uppercase">{vital}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition Grids */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Checkbox Condition Grids</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Grids of tick boxes for screening diagnostic checks (e.g. RE vs LE).</p>
                </div>
                <button
                  type="button"
                  onClick={addGrid}
                  className="flex items-center gap-1 text-[11px] font-bold text-violet-650 hover:text-violet-850"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Grid</span>
                </button>
              </div>

              {grids.map((grid, index) => (
                <div key={index} className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl relative space-y-3">
                  <button
                    type="button"
                    onClick={() => removeGrid(index)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="space-y-1.5 pr-8">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Grid Title</label>
                    <input 
                      type="text" 
                      value={grid.name} 
                      onChange={e => updateGridName(index, e.target.value)}
                      placeholder="e.g. Cataract Screening"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Columns (Comma separated)</label>
                      <input 
                        type="text" 
                        value={grid.columns.join(', ')} 
                        onChange={e => updateGridColumns(index, e.target.value)}
                        placeholder="e.g. RE, LE"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Rows / Questions (Comma separated)</label>
                      <input 
                        type="text" 
                        value={grid.rows.join(', ')} 
                        onChange={e => updateGridRows(index, e.target.value)}
                        placeholder="e.g. Lid, Cornea, Lens"
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-300"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Dropdowns */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Dropdown Choices</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Custom select-box questions (e.g. Visual Acuity levels).</p>
                </div>
                <button
                  type="button"
                  onClick={addDropdown}
                  className="flex items-center gap-1 text-[11px] font-bold text-violet-650 hover:text-violet-850"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Add Select Box</span>
                </button>
              </div>

              {dropdowns.map((dropdown, index) => (
                <div key={index} className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-2xl relative space-y-3">
                  <button
                    type="button"
                    onClick={() => removeDropdown(index)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-rose-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="space-y-1.5 pr-8">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Question Name</label>
                    <input 
                      type="text" 
                      value={dropdown.name} 
                      onChange={e => updateDropdownName(index, e.target.value)}
                      placeholder="e.g. Visual Acuity"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Options (Comma separated)</label>
                    <input 
                      type="text" 
                      value={dropdown.options.join(', ')} 
                      onChange={e => updateDropdownOptions(index, e.target.value)}
                      placeholder="e.g. 6/6, 6/9, 6/12, 6/18"
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-violet-300"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-6 py-3 bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-600/10 active:scale-95 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Diagnostic Template</span>
              </button>
            </div>
          </form>

          {/* Tips card */}
          <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6 shadow-sm space-y-4 text-left">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <Activity className="h-4.5 w-4.5 text-violet-500 animate-pulse" />
              <span>Form Configuration Guide</span>
            </h3>
            <div className="text-[11px] leading-relaxed text-slate-650 space-y-3 font-medium">
              <p><strong>Dynamic Rendering:</strong> These templates construct diagnostic screens automatically in the mobile app. Toggled vitals show numeric input fields.</p>
              <p><strong>Checkbox Matrix:</strong> Specifying columns like <code className="bg-slate-100 px-1 rounded">RE, LE</code> and rows like <code className="bg-slate-100 px-1 rounded">Cataract, Lens Opacity</code> renders a matrix grid on mobile where employees can screen conditions side-by-side.</p>
              <p><strong>Dropdown Questions:</strong> Ideal for visual acuity scales or clinical diagnosis options where select limits reduce data typos.</p>
            </div>
          </div>
        </div>
      ) : (
        /* Templates List */
        <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-3xl p-6 shadow-sm text-left">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
              <span className="text-xs font-bold text-slate-500">Loading templates schema...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center">
              <FolderOpen className="h-10 w-10 text-slate-300" />
              <span className="text-sm font-bold text-slate-700">No Templates Found</span>
              <p className="text-xs text-slate-400 max-w-xs">Create your first diagnostic test template to assign to camp campaigns.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => {
                const vitals = template.vitals || [];
                const questions = template.questions || {};
                const gridsList = questions.grids || [];
                const dropdownsList = questions.dropdowns || [];

                return (
                  <div key={template.id} className="border border-slate-200/70 hover:border-violet-300 hover:shadow-md bg-white p-5 rounded-2xl flex flex-col justify-between transition-all group">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="bg-violet-550/10 p-2.5 rounded-xl text-violet-650 group-hover:bg-violet-600 group-hover:text-white transition">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(template)}
                            className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-extrabold text-sm text-slate-800 group-hover:text-violet-750 transition truncate">
                          {template.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ID: TEMPLATE-{template.id}</span>
                      </div>

                      {/* Summary details */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-455">Vitals Included:</span>
                          <span className="text-slate-800 uppercase">{vitals.length > 0 ? vitals.join(', ') : 'None'}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-455">Condition Grids:</span>
                          <span className="text-slate-800">{gridsList.map(g => g.name).join(', ') || '0 configured'}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-455">Dropdown fields:</span>
                          <span className="text-slate-800">{dropdownsList.map(d => d.name).join(', ') || '0 configured'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestTemplates;
