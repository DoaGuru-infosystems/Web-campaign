import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

export interface DiagnosticTestFormScreenProps {
  serverUrl: string;
  token?: string;
  registrationId: string; // The patient's registration code or ID
  campaign: any; // Current campaign object
  onSaveSuccess: () => void;
  onClose: () => void;
  isOfflineMode?: boolean;
  updateUnsyncedCounts?: () => void;
}

export const DiagnosticTestFormScreen: React.FC<DiagnosticTestFormScreenProps> = ({
  serverUrl,
  token,
  registrationId,
  campaign,
  onSaveSuccess,
  onClose,
  isOfflineMode = false,
  updateUnsyncedCounts,
}) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [template, setTemplate] = useState<any>(null);

  // Vitals State
  const [bp, setBp] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  
  // BMI Computed States
  const [bmi, setBmi] = useState<string>('—');
  const [bmiCategory, setBmiCategory] = useState<string>('');

  // Grid / Checkboxes State: mapping condition -> { 'Column Name': boolean }
  const [gridData, setGridData] = useState<Record<string, Record<string, boolean>>>({});
  
  // Dropdowns values: mapping select field label -> selected value
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  
  // Notes
  const [notes, setNotes] = useState('');

  // Auto compute BMI
  useEffect(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const heightInMeters = h / 100;
      const computedBmi = w / (heightInMeters * heightInMeters);
      const bmiVal = computedBmi.toFixed(1);
      setBmi(bmiVal);

      if (computedBmi < 18.5) {
        setBmiCategory('UNDERWEIGHT');
      } else if (computedBmi < 25) {
        setBmiCategory('NORMAL');
      } else if (computedBmi < 30) {
        setBmiCategory('OVERWEIGHT');
      } else {
        setBmiCategory('OBESE');
      }
    } else {
      setBmi('—');
      setBmiCategory('');
    }
  }, [weight, height]);

  // Load diagnostic template assigned to the campaign
  useEffect(() => {
    const loadTemplate = async () => {
      setFetching(true);
      try {
        let selectedTpl = null;

        if (isOfflineMode) {
          if (campaign.test_template_id) {
            selectedTpl = await OfflineManager.getCachedTemplate(campaign.test_template_id);
          }
        } else {
          try {
            // Fetch all templates and find the one assigned to this campaign
            const res = await API_CALLS.get('/test-templates', serverUrl, token);
            const templates = res.templates || [];
            selectedTpl = templates.find((t: any) => t.id === campaign.test_template_id);
          } catch (tplErr) {
            // Fallback to cache if online call fails
            if (campaign.test_template_id) {
              selectedTpl = await OfflineManager.getCachedTemplate(campaign.test_template_id);
            }
          }
        }

        const initialGrid: Record<string, Record<string, boolean>> = {};
        const initialSelects: Record<string, string> = {};

        if (selectedTpl) {
          setTemplate(selectedTpl);
          
          // Pre-populate grid structure
          if (Array.isArray(selectedTpl.questions?.grids)) {
            selectedTpl.questions.grids.forEach((grid: any) => {
              const rows = grid.rows || [];
              const cols = grid.columns || [];
              const rowsToInit = rows.length > 0 ? rows : [grid.name || 'Clinical Examination'];
              rowsToInit.forEach((row: string) => {
                initialGrid[row] = initialGrid[row] || {};
                cols.forEach((col: string) => {
                  initialGrid[row][col] = false;
                });
              });
            });
          } else if (selectedTpl.questions?.grid) {
            const rows = selectedTpl.questions.grid.rows || [];
            const cols = selectedTpl.questions.grid.columns || [];
            const rowsToInit = rows.length > 0 ? rows : [selectedTpl.questions.grid.name || 'Clinical Examination'];
            rowsToInit.forEach((row: string) => {
              initialGrid[row] = {};
              cols.forEach((col: string) => {
                initialGrid[row][col] = false;
              });
            });
          }

          // Pre-populate select values
          if (Array.isArray(selectedTpl.questions?.dropdowns)) {
            selectedTpl.questions.dropdowns.forEach((dd: any) => {
              const label = dd.name || dd.label;
              if (label) {
                initialSelects[label] = dd.options?.[0] || '';
              }
            });
          } else if (Array.isArray(selectedTpl.questions?.selects)) {
            selectedTpl.questions.selects.forEach((sel: any) => {
              initialSelects[sel.label] = sel.options?.[0] || '';
            });
          }
        } else {
          // No template available, use default Eye Screening form
          const defaultTpl = {
            title: 'Standard Eye Screening',
            vitals: ['bp', 'pulse', 'temp', 'spo2', 'weight', 'height'],
            questions: {
              grid: {
                columns: ['Left Eye', 'Right Eye'],
                rows: ['Cataract', 'Glaucoma Suspect', 'Refractive Error', 'Macular Degeneration', 'Diabetic Retinopathy', 'Conjunctivitis']
              },
              selects: [
                { label: 'Visual Acuity Left (OD)', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'] },
                { label: 'Visual Acuity Right (OS)', options: ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'] }
              ]
            }
          };
          setTemplate(defaultTpl);

          defaultTpl.questions.grid.rows.forEach(row => {
            initialGrid[row] = {};
            defaultTpl.questions.grid.columns.forEach(col => {
              initialGrid[row][col] = false;
            });
          });

          defaultTpl.questions.selects.forEach(sel => {
            initialSelects[sel.label] = sel.options[0];
          });
        }

        // Fetch existing test data for this registration to make it updatable!
        let testObj = null;

        // Try to fetch offline first
        const localTests = await OfflineManager.getOfflineTests();
        const localTest = localTests.find(t => t.registrationId === registrationId);

        if (localTest) {
          testObj = {
            vitals_data: localTest.vitals_data,
            test_data: {
              grid: localTest.test_data?.grid || {},
              selects: localTest.test_data?.selects || {}
            }
          };
        } else if (!isOfflineMode && !registrationId.startsWith('OFFLINE-')) {
          try {
            const testRes = await API_CALLS.get(`/registrations/${registrationId}/test`, serverUrl, token);
            if (testRes && testRes.test) {
              testObj = testRes.test;
            }
          } catch (err) {
            console.log('No online test data found:', err);
          }
        }

        if (testObj) {
          // Populate vitals
          if (testObj.vitals_data) {
            const v = testObj.vitals_data;
            if (v.bp !== undefined) setBp(String(v.bp ?? ''));
            if (v.pulse !== undefined) setPulse(String(v.pulse ?? ''));
            if (v.temp !== undefined) setTemp(String(v.temp ?? ''));
            if (v.spo2 !== undefined) setSpo2(String(v.spo2 ?? ''));
            if (v.weight !== undefined) setWeight(String(v.weight ?? ''));
            if (v.height !== undefined) setHeight(String(v.height ?? ''));
            if (v.notes !== undefined) setNotes(String(v.notes ?? ''));
          }
          
          // Populate grid checkboxes
          if (testObj.test_data && testObj.test_data.grid) {
            Object.keys(testObj.test_data.grid).forEach(row => {
              initialGrid[row] = {
                ...(initialGrid[row] || {}),
                ...(testObj.test_data.grid[row] || {})
              };
            });
          }
          
          // Populate dropdowns
          if (testObj.test_data && testObj.test_data.selects) {
            Object.keys(testObj.test_data.selects).forEach(key => {
              initialSelects[key] = testObj.test_data.selects[key];
            });
          }
        }

        // Finally set the consolidated states
        setGridData(initialGrid);
        setSelectValues(initialSelects);

      } catch (err) {
        console.error('Failed to load template:', err);
      } finally {
        setFetching(false);
      }
    };

    loadTemplate();
  }, [campaign, registrationId]);

  const handleSaveTest = async () => {
    setLoading(true);
    
    const vitalsData = {
      bp,
      pulse,
      temp,
      spo2,
      weight,
      height,
      bmi,
      bmi_category: bmiCategory,
      notes
    };

    const payload = {
      vitals_data: vitalsData,
      test_data: {
        grid: gridData,
        selects: selectValues
      }
    };

    try {
      if (isOfflineMode || registrationId.startsWith('OFFLINE-')) {
        await OfflineManager.queueTest(
          registrationId,
          vitalsData,
          payload.test_data
        );
        Alert.alert('Diagnostic Test Saved Offline', 'Patient test entries have been successfully saved locally.');
        if (updateUnsyncedCounts) updateUnsyncedCounts();
        onSaveSuccess();
      } else {
        await API_CALLS.post(`/registrations/${registrationId}/test`, payload, serverUrl, token);
        Alert.alert('Diagnostic Test Saved', 'The patient test entries have been successfully saved.');
        onSaveSuccess();
      }
    } catch (err: any) {
      Alert.alert('Error Saving Test', err.message || 'Failed to save patient test.');
    } finally {
      setLoading(false);
    }
  };

  const getBmiBadgeStyle = () => {
    switch (bmiCategory) {
      case 'NORMAL':
        return { container: styles.bmiNormalContainer, text: styles.bmiNormalText };
      case 'UNDERWEIGHT':
        return { container: styles.bmiWarningContainer, text: styles.bmiWarningText };
      case 'OVERWEIGHT':
        return { container: styles.bmiWarningContainer, text: styles.bmiWarningText };
      case 'OBESE':
        return { container: styles.bmiDangerContainer, text: styles.bmiDangerText };
      default:
        return { container: styles.bmiDefaultContainer, text: styles.bmiDefaultText };
    }
  };

  const toggleGridCheckbox = (row: string, col: string) => {
    setGridData(prev => ({
      ...prev,
      [row]: {
        ...prev[row],
        [col]: !prev[row]?.[col]
      }
    }));
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Initializing patient test form...</Text>
      </View>
    );
  }

  const enabledVitals = template?.vitals || [];

  const gridsToRender: any[] = [];
  if (Array.isArray(template?.questions?.grids)) {
    gridsToRender.push(...template.questions.grids);
  } else if (template?.questions?.grid) {
    gridsToRender.push({
      name: template.questions.grid.name || 'Clinical Examination',
      rows: template.questions.grid.rows || [],
      columns: template.questions.grid.columns || [],
    });
  }

  const dropdownsToRender: any[] = [];
  if (Array.isArray(template?.questions?.dropdowns)) {
    template.questions.dropdowns.forEach((dd: any) => {
      dropdownsToRender.push({
        label: dd.name || dd.label,
        options: dd.options || [],
      });
    });
  } else if (Array.isArray(template?.questions?.selects)) {
    dropdownsToRender.push(...template.questions.selects);
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topAppBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appBarTitle}>{template?.title || 'Diagnostic Test Form'}</Text>
          <Text style={styles.appBarSubtitle}>Patient Registration ID: {registrationId}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Section 1: Patient Vitals */}
        {enabledVitals.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>📈 Patient Vitals</Text>
              <Text style={styles.requiredLabel}>Required fields *</Text>
            </View>

            {enabledVitals.includes('bp') && (
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Blood Pressure (mmHg) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={bp}
                  onChangeText={setBp}
                  placeholder="e.g., 120/80"
                />
              </View>
            )}

            {enabledVitals.includes('pulse') && (
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Pulse Rate (BPM) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={pulse}
                  onChangeText={setPulse}
                  placeholder="e.g., 72"
                  keyboardType="numeric"
                />
              </View>
            )}

            {enabledVitals.includes('temp') && (
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>Temperature (°F) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={temp}
                  onChangeText={setTemp}
                  placeholder="e.g., 98.6"
                  keyboardType="numeric"
                />
              </View>
            )}

            {enabledVitals.includes('spo2') && (
              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>SpO2 (%) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={spo2}
                  onChangeText={setSpo2}
                  placeholder="e.g., 98"
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.rowInputs}>
              {enabledVitals.includes('weight') && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Weight (kg) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="e.g., 70"
                    keyboardType="numeric"
                  />
                </View>
              )}

              {enabledVitals.includes('height') && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Height (cm) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={height}
                    onChangeText={setHeight}
                    placeholder="e.g., 170"
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            {/* Calculated BMI */}
            {enabledVitals.includes('weight') && enabledVitals.includes('height') && (
              <View style={styles.bmiDisplayCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bmiLabel}>Calculated BMI</Text>
                  <Text style={styles.bmiValue}>{bmi}</Text>
                </View>
                {bmiCategory ? (
                  <View style={[styles.bmiBadge, getBmiBadgeStyle().container]}>
                    <Text style={[styles.bmiBadgeText, getBmiBadgeStyle().text]}>{bmiCategory}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* Section 2: Clinical Examination (Custom table grids) */}
        {gridsToRender.map((grid: any, gridIdx: number) => {
          const gridCols = grid.columns || [];
          const gridRows = grid.rows || [];
          const rowsToRender = gridRows.length > 0 ? gridRows : [grid.name || 'Clinical Examination'];
          if (rowsToRender.length === 0) return null;

          return (
            <View key={`grid-${gridIdx}`} style={styles.card}>
              {gridRows.length > 0 && (
                <>
                  <Text style={styles.cardHeaderTitle}>👁️ {grid.name || 'Clinical Examination'}</Text>
                  <Text style={styles.cardSubTitle}>Mark checkboxes for diagnostic findings:</Text>
                </>
              )}

              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'left' }]}>
                  {gridRows.length > 0 ? 'Condition' : (grid.name || 'Clinical Examination')}
                </Text>
                {gridCols.map((col: string, idx: number) => (
                  <Text key={idx} style={styles.tableHeaderCell}>{col}</Text>
                ))}
              </View>

              {/* Table Rows */}
              {rowsToRender.map((row: string, rowIdx: number) => (
                <View key={rowIdx} style={styles.tableDataRow}>
                  <Text style={[styles.tableRowName, { flex: 2 }]}>{row}</Text>
                  {gridCols.map((col: string, colIdx: number) => {
                    const isChecked = gridData[row]?.[col] || false;
                    return (
                      <TouchableOpacity
                        key={colIdx}
                        style={styles.checkboxCell}
                        onPress={() => toggleGridCheckbox(row, col)}
                      >
                        <View style={[styles.checkboxOutline, isChecked && styles.checkboxChecked]}>
                          {isChecked && <Text style={styles.checkboxCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        {/* Section 3: Diagnostic Dropdowns */}
        {dropdownsToRender.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>📋 Diagnostic Dropdowns</Text>
            {dropdownsToRender.map((field: any, idx: number) => (
              <View key={idx} style={[styles.inputBlock, { marginTop: 12 }]}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => {
                    Alert.alert(
                      field.label,
                      'Choose finding:',
                      field.options.map((opt: string) => ({
                        text: opt,
                        onPress: () => setSelectValues(prev => ({ ...prev, [field.label]: opt }))
                      }))
                    );
                  }}
                >
                  <Text style={styles.dropdownValueText}>
                    {selectValues[field.label] || 'Select choice'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>📝 Additional Notes</Text>
          <TextInput
            style={[styles.textInput, { height: 100, textAlignVertical: 'top', marginTop: 10 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Record observations, patient complaints, or unusual findings here..."
            multiline
          />
        </View>

        {/* Save button */}
        <TouchableOpacity style={styles.saveTestBtn} onPress={handleSaveTest} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={styles.saveBtnRow}>
              <SvgIcon type="check" color="#ffffff" size={16} />
              <Text style={styles.saveTestBtnText}>Save Test</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Premium dark background wrapper
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  topAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  appBarTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  appBarSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  closeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  scrollContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e293b',
  },
  requiredLabel: {
    fontSize: 10,
    color: '#94a3b8',
  },
  inputBlock: {
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
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  // BMI Display
  bmiDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#dcfce7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  bmiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
  },
  bmiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#166534',
    marginTop: 2,
  },
  bmiBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bmiBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  // BMI statuses colors
  bmiNormalContainer: { backgroundColor: '#bbf7d0' },
  bmiNormalText: { color: '#166534' },
  bmiWarningContainer: { backgroundColor: '#fef08a' },
  bmiWarningText: { color: '#854d0e' },
  bmiDangerContainer: { backgroundColor: '#fecaca' },
  bmiDangerText: { color: '#991b1b' },
  bmiDefaultContainer: { backgroundColor: '#e2e8f0' },
  bmiDefaultText: { color: '#475569' },
  // Table Custom grid styles
  cardSubTitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  checkboxCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOutline: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0a4a9f',
    borderColor: '#0a4a9f',
  },
  checkboxCheckmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  dropdownValueText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#64748b',
  },
  // Save diagnostic button
  saveTestBtn: {
    backgroundColor: '#0a4a9f',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 40,
    shadowColor: '#0a4a9f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveTestBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
