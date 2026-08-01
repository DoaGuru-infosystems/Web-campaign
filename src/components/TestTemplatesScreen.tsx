import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { styles as globalStyles } from '../styles/theme';
import { API_CALLS } from '../utils/api';

export interface TestTemplatesScreenProps {
  serverUrl: string;
  token?: string;
  onClose: () => void;
  onOpenMenu?: () => void;
}

export const TestTemplatesScreen: React.FC<TestTemplatesScreenProps> = ({
  serverUrl,
  token,
  onClose,
  onOpenMenu,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Form Builder State
  const [title, setTitle] = useState('');
  
  // Vitals toggles
  const [vitals, setVitals] = useState({
    bp: true,
    pulse: true,
    temp: true,
    spo2: true,
    weight: true,
    height: true,
  });

  // Table Grid Config
  const [gridColumns, setGridColumns] = useState<string[]>(['Left Eye', 'Right Eye']);
  const [gridRows, setGridRows] = useState<string[]>([
    'Cataract',
    'Glaucoma Suspect',
    'Refractive Error',
    'Macular Degeneration',
    'Diabetic Retinopathy',
    'Conjunctivitis'
  ]);
  
  // Select fields (like Visual Acuity)
  const [selectFields, setSelectFields] = useState<any[]>([
    { label: 'Visual Acuity Left (OD)', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'] },
    { label: 'Visual Acuity Right (OS)', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'] }
  ]);

  const fetchTemplates = async () => {
    setFetching(true);
    try {
      const res = await API_CALLS.get('/test-templates', serverUrl, token);
      setTemplates(res.templates || []);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required Title', 'Please enter a name for the Test Template.');
      return;
    }

    setLoading(true);
    const activeVitals = Object.keys(vitals).filter(k => vitals[k as keyof typeof vitals]);
    
    const payload = {
      title: title.trim(),
      vitals: activeVitals,
      questions: {
        grid: {
          columns: gridColumns.filter(c => c.trim() !== ''),
          rows: gridRows.filter(r => r.trim() !== '')
        },
        selects: selectFields.filter(s => s.label.trim() !== '')
      }
    };

    try {
      await API_CALLS.post('/test-templates', payload, serverUrl, token);
      Alert.alert('Success', 'Diagnostic Test template saved successfully!');
      setIsCreating(false);
      setTitle('');
      fetchTemplates();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save test template.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this test template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API_CALLS.post(`/test-templates/${id}?_method=DELETE`, {}, serverUrl, token);
              fetchTemplates();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete template.');
            }
          }
        }
      ]
    );
  };

  const addGridColumn = () => {
    setGridColumns([...gridColumns, `Column ${gridColumns.length + 1}`]);
  };

  const removeGridColumn = (index: number) => {
    setGridColumns(gridColumns.filter((_, i) => i !== index));
  };

  const updateGridColumn = (text: string, index: number) => {
    const updated = [...gridColumns];
    updated[index] = text;
    setGridColumns(updated);
  };

  const addGridRow = () => {
    setGridRows([...gridRows, `Condition ${gridRows.length + 1}`]);
  };

  const removeGridRow = (index: number) => {
    setGridRows(gridRows.filter((_, i) => i !== index));
  };

  const updateGridRow = (text: string, index: number) => {
    const updated = [...gridRows];
    updated[index] = text;
    setGridRows(updated);
  };

  const addSelectField = () => {
    setSelectFields([...selectFields, { label: 'New Dropdown', options: ['Option 1', 'Option 2'] }]);
  };

  const removeSelectField = (index: number) => {
    setSelectFields(selectFields.filter((_, i) => i !== index));
  };

  const updateSelectLabel = (text: string, index: number) => {
    const updated = [...selectFields];
    updated[index].label = text;
    setSelectFields(updated);
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        {onOpenMenu && (
          <TouchableOpacity onPress={onOpenMenu} style={{ padding: 8, marginRight: 4 }}>
            <SvgIcon type="menu" color="#1e293b" size={22} />
          </TouchableOpacity>
        )}
        <Text style={styles.screenHeaderTitle}>
          {isCreating ? 'Create Diagnostic Form' : 'Test Form Templates'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeHeaderBtn}>
          <Text style={styles.closeHeaderText}>✕</Text>
        </TouchableOpacity>
      </View>

      {isCreating ? (
        // FORM BUILDER
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.builderCard}>
              <Text style={styles.cardSectionHeader}>Form Identity</Text>
              <Text style={styles.inputLabel}>Template Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Eye & Vitals Diagnosis"
              />
            </View>

            {/* Vitals Picker */}
            <View style={styles.builderCard}>
              <Text style={styles.cardSectionHeader}>Patient Vitals to Collect</Text>
              <Text style={styles.cardSublabel}>Select the physical measurements this form will collect:</Text>
              
              {Object.keys(vitals).map((key) => {
                const labelMap = {
                  bp: 'Blood Pressure (mmHg)',
                  pulse: 'Pulse Rate (BPM)',
                  temp: 'Temperature (°F)',
                  spo2: 'SpO2 (%)',
                  weight: 'Weight (kg)',
                  height: 'Height (cm)',
                };
                const val = vitals[key as keyof typeof vitals];
                return (
                  <View key={key} style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{labelMap[key as keyof typeof labelMap]}</Text>
                    <Switch
                      value={val}
                      onValueChange={(newVal) => setVitals(prev => ({ ...prev, [key]: newVal }))}
                    />
                  </View>
                );
              })}
            </View>

            {/* Customizable Grid */}
            <View style={styles.builderCard}>
              <Text style={styles.cardSectionHeader}>Table/Grid Questions</Text>
              <Text style={styles.cardSublabel}>Define custom test matrices with tick boxes (like left/right eye cataract/refractive checks):</Text>

              {/* Grid Columns */}
              <View style={styles.listHeaderRow}>
                <Text style={styles.listSectionTitle}>Columns (Inputs/Sides)</Text>
                <TouchableOpacity onPress={addGridColumn} style={styles.miniAddBtn}>
                  <Text style={styles.miniAddBtnText}>+ Add Column</Text>
                </TouchableOpacity>
              </View>

              {gridColumns.map((col, index) => (
                <View key={index} style={styles.rowItemInput}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={col}
                    onChangeText={(text) => updateGridColumn(text, index)}
                    placeholder="e.g. Left Eye"
                  />
                  <TouchableOpacity onPress={() => removeGridColumn(index)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Grid Rows */}
              <View style={[styles.listHeaderRow, { marginTop: 16 }]}>
                <Text style={styles.listSectionTitle}>Rows (Conditions/Tests)</Text>
                <TouchableOpacity onPress={addGridRow} style={styles.miniAddBtn}>
                  <Text style={styles.miniAddBtnText}>+ Add Row</Text>
                </TouchableOpacity>
              </View>

              {gridRows.map((row, index) => (
                <View key={index} style={styles.rowItemInput}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={row}
                    onChangeText={(text) => updateGridRow(text, index)}
                    placeholder="e.g. Cataract"
                  />
                  <TouchableOpacity onPress={() => removeGridRow(index)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Dropdown Selects */}
            <View style={styles.builderCard}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.cardSectionHeader}>Dropdown Selects (Visual Acuity, etc)</Text>
                <TouchableOpacity onPress={addSelectField} style={styles.miniAddBtn}>
                  <Text style={styles.miniAddBtnText}>+ Add Select</Text>
                </TouchableOpacity>
              </View>

              {selectFields.map((field, index) => (
                <View key={index} style={styles.rowItemInput}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={field.label}
                    onChangeText={(text) => updateSelectLabel(text, index)}
                    placeholder="Dropdown Field Label"
                  />
                  <TouchableOpacity onPress={() => removeSelectField(index)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Bottom Action Bar */}
          <View style={styles.saveBar}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreating(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Template</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // TEMPLATE LIST VIEW
        <View style={{ flex: 1 }}>
          <View style={styles.listSubbar}>
            <Text style={styles.listCountText}>{templates.length} Active Test Templates</Text>
            <TouchableOpacity style={styles.createNewBtn} onPress={() => setIsCreating(true)}>
              <SvgIcon type="plus" color="#ffffff" size={14} />
              <Text style={styles.createNewBtnText}>New Template</Text>
            </TouchableOpacity>
          </View>

          {templates.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No Diagnostic Templates</Text>
              <Text style={styles.emptySubText}>Create customizable diagnostic questionnaires for camp patients.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {templates.map((tpl) => (
                <View key={tpl.id} style={styles.templateCard}>
                  <View style={styles.templateCardHeader}>
                    <View>
                      <Text style={styles.templateTitle}>{tpl.title}</Text>
                      <Text style={styles.templateDate}>Created: {new Date(tpl.created_at).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(tpl.id)} style={styles.deleteCardBtn}>
                      <SvgIcon type="trash" color="#ef4444" size={18} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.badgeRow}>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>Vitals: {tpl.vitals?.length || 0}</Text>
                    </View>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>Grid: {tpl.questions?.grid?.rows?.length || 0} items</Text>
                    </View>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>Selects: {tpl.questions?.selects?.length || 0}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  screenHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  closeHeaderBtn: {
    padding: 6,
  },
  closeHeaderText: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  builderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 16,
  },
  cardSectionHeader: {
    fontSize: 13,
    fontWeight: '900',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 12,
  },
  cardSublabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  miniAddBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e0e7ff',
    borderRadius: 6,
  },
  miniAddBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  rowItemInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  saveBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  // LIST VIEWS
  listSubbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  listCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  createNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  createNewBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  templateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  templateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  templateDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  deleteCardBtn: {
    padding: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
});
