import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Switch, Alert, ActivityIndicator, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SvgIcon } from './SvgIcon';
import { styles as globalStyles } from '../styles/theme';
import { API_CALLS } from '../utils/api';

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
  'Dropdown',
  'Radio Button',
  'Checkbox',
  'Signature Upload',
  'Address',
  'Aadhaar Number',
  'PAN Number',
  'Click Photo',
  'Age',
  'Gender',
  'Yes/No Field'
];

export interface CreateCampaignScreenProps {
  serverUrl: string;
  token?: string;
  campaignIdToEdit: number | null;
  onClose: () => void;
  onOpenMenu?: () => void;
}

export const CreateCampaignScreen: React.FC<CreateCampaignScreenProps> = ({
  serverUrl,
  token,
  campaignIdToEdit,
  onClose,
  onOpenMenu,
}) => {
  const isEditMode = !!campaignIdToEdit;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'fields'>('settings');

  // Campaign Info Settings
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [category, setCategory] = useState('Health Camp');
  const [customCategory, setCustomCategory] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published' | 'Closed'>('Published');
  const [submissionLimit, setSubmissionLimit] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('Thank you for registering! Your submission was recorded successfully.');
  const [regIdPrefix, setRegIdPrefix] = useState('CMP-2026');
  const [testTemplateId, setTestTemplateId] = useState<string>('');
  const [templatesList, setTemplatesList] = useState<any[]>([]);

  // Form Fields
  const [fields, setFields] = useState<any[]>([]);

  const handleBannerUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to upload a banner.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setBannerUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: 'banner.jpg', type: 'image/jpeg' } as any);
      const resp = await fetch(`${serverUrl}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const json = await resp.json();
      if (json.url) setBannerUrl(json.url);
      else Alert.alert('Upload failed', 'Server did not return a URL.');
    } catch (e: any) {
      Alert.alert('Upload error', e.message || 'Banner upload failed.');
    } finally {
      setBannerUploading(false);
    }
  };

  // Fetch templates and campaign if editing
  useEffect(() => {
    const initScreen = async () => {
      setFetching(true);
      try {
        const templatesRes = await API_CALLS.get('/test-templates', serverUrl, token);
        setTemplatesList(templatesRes.templates || []);

        if (isEditMode && campaignIdToEdit) {
          const res = await API_CALLS.get(`/campaigns/${campaignIdToEdit}`, serverUrl, token);
          const c = res.campaign;
          setTitle(c.title || '');
          setDescription(c.description || '');
          setStartDate(c.start_date ? c.start_date.split('T')[0] : '');
          setEndDate(c.end_date ? c.end_date.split('T')[0] : '');
          
          if (categories.includes(c.category)) {
            setCategory(c.category);
            setCustomCategory('');
          } else {
            setCategory('Other');
            setCustomCategory(c.category || '');
          }
          
          setStatus(c.status || 'Published');
          setSubmissionLimit(c.submission_limit ? String(c.submission_limit) : '');
          setThankYouMessage(c.thank_you_message || '');
          setRegIdPrefix(c.registration_id_prefix || 'CMP-2026');
          setTestTemplateId(c.test_template_id ? String(c.test_template_id) : '');

          const loadedFields = (res.fields || []).map((f: any, idx: number) => ({
            ...f,
            _key: f.id ? String(f.id) : `field_${idx}_${Date.now()}`
          }));
          setFields(loadedFields);
        } else {
          // Default template fields
          setFields([
            {
              _key: 'default_name',
              field_name: 'full_name',
              label: 'Full Name',
              field_type: 'Single Line Text',
              placeholder: 'Enter full name',
              is_required: true,
              options: [],
              sort_order: 0
            },
            {
              _key: 'default_aadhar',
              field_name: 'aadhar_number',
              label: 'Aadhaar Card Number',
              field_type: 'Aadhaar Number',
              placeholder: 'Enter 12 digit Aadhaar',
              is_required: true,
              options: [],
              sort_order: 1
            }
          ]);
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to initialize campaign form.');
        onClose();
      } finally {
        setFetching(false);
      }
    };

    initScreen();
  }, [campaignIdToEdit]);

  const addField = () => {
    const newField = {
      _key: `field_${Date.now()}_${Math.random()}`,
      field_name: `custom_field_${Date.now()}`,
      label: '',
      field_type: 'Single Line Text',
      placeholder: '',
      is_required: false,
      options: ['Option 1', 'Option 2'],
      sort_order: fields.length
    };
    setFields([...fields, newField]);
  };

  const deleteField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated.map((f, i) => ({ ...f, sort_order: i })));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFields(updated.map((f, i) => ({ ...f, sort_order: i })));
  };

  const updateField = (index: number, key: string, val: any) => {
    const updated = [...fields];
    updated[index][key] = val;
    if (key === 'label') {
      const slug = val.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 30);
      updated[index]['field_name'] = slug || `field_${index}`;
    }
    setFields(updated);
  };

  const addFieldOption = (fieldIndex: number) => {
    const updated = [...fields];
    if (!updated[fieldIndex].options) updated[fieldIndex].options = [];
    updated[fieldIndex].options.push(`Option ${updated[fieldIndex].options.length + 1}`);
    setFields(updated);
  };

  const updateFieldOption = (fieldIndex: number, optionIndex: number, val: string) => {
    const updated = [...fields];
    updated[fieldIndex].options[optionIndex] = val;
    setFields(updated);
  };

  const deleteFieldOption = (fieldIndex: number, optionIndex: number) => {
    const updated = [...fields];
    updated[fieldIndex].options = updated[fieldIndex].options.filter((_: any, i: number) => i !== optionIndex);
    setFields(updated);
  };

  const handleSave = async () => {
    const finalCategory = category === 'Other' ? customCategory.trim() : category;
    if (!title || !startDate || !endDate || !finalCategory) {
      Alert.alert('Required Fields', 'Please complete the title, date ranges, and campaign category.');
      return;
    }
    if (fields.length === 0) {
      Alert.alert('Form Fields Required', 'Please add at least one dynamic question field.');
      return;
    }

    setLoading(true);
    // Auto sort Aadhaar fields to top (to align with the backend and scanner logic)
    const sortedFields = [...fields].sort((a, b) => {
      const aLower = (a.label || '').toLowerCase();
      const bLower = (b.label || '').toLowerCase();
      const aIsAadhar = aLower.includes('aadhar') || aLower.includes('aadhaar') || a.field_type === 'Aadhaar Number';
      const bIsAadhar = bLower.includes('aadhar') || bLower.includes('aadhaar') || b.field_type === 'Aadhaar Number';
      if (aIsAadhar && !bIsAadhar) return -1;
      if (!aIsAadhar && bIsAadhar) return 1;
      return 0;
    }).map((f, i) => ({ ...f, sort_order: i }));

    const payload = {
      title,
      description,
      banner_url: bannerUrl || null,
      start_date: startDate,
      end_date: endDate,
      category: finalCategory,
      status,
      submission_limit: submissionLimit ? parseInt(submissionLimit) : null,
      thank_you_message: thankYouMessage,
      registration_id_prefix: regIdPrefix,
      test_template_id: testTemplateId ? parseInt(testTemplateId) : null,
      fields: sortedFields
    };

    try {
      if (isEditMode && campaignIdToEdit) {
        await API_CALLS.post(`/campaigns/${campaignIdToEdit}?_method=PUT`, payload, serverUrl, token);
      } else {
        await API_CALLS.post('/campaigns', payload, serverUrl, token);
      }
      Alert.alert('Success', 'Campaign saved successfully!', [{ text: 'OK', onPress: onClose }]);
    } catch (err: any) {
      Alert.alert('Publish Error', err.message || 'Could not save campaign details.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Fetching campaign config...</Text>
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
          {isEditMode ? 'Edit Campaign' : 'Create Campaign'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeHeaderBtn}>
          <Text style={styles.closeHeaderText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabItemText, activeTab === 'settings' && styles.tabItemTextActive]}>
            1. Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'fields' && styles.tabItemActive]}
          onPress={() => setActiveTab('fields')}
        >
          <Text style={[styles.tabItemText, activeTab === 'fields' && styles.tabItemTextActive]}>
            2. Fields ({fields.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'settings' ? (
          <View style={styles.tabBody}>
            {/* General Info Card */}
            <View style={styles.builderCard}>
              <Text style={styles.cardSectionHeader}>General Campaign Info</Text>
              
              <Text style={styles.inputLabel}>Campaign Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Dental Health Camp"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Provide goals and instructions for participants..."
                multiline
              />

              <Text style={styles.inputLabel}>Campaign Banner (Optional)</Text>
              {bannerUrl ? (
                <View>
                  <Image source={{ uri: bannerUrl.startsWith('/') ? `${serverUrl}${bannerUrl}` : bannerUrl }} style={{ width: '100%', height: 120, borderRadius: 10, marginBottom: 8 }} resizeMode="cover" />
                  <TouchableOpacity onPress={() => setBannerUrl('')} style={[styles.textInput, { alignItems: 'center', paddingVertical: 8 }]}>
                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>✕ Remove Banner</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={{ borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 20, alignItems: 'center', gap: 6 }}
                  onPress={handleBannerUpload}
                  disabled={bannerUploading}
                >
                  {bannerUploading ? (
                    <ActivityIndicator color="#7c3aed" />
                  ) : (
                    <>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                      <Text style={{ fontSize: 12, color: '#7c3aed', fontWeight: '700' }}>Upload Banner Image</Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>JPG or PNG, displayed on campaign card</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.catOptionList}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catOptionBadge, category === cat && styles.catOptionBadgeActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catOptionBadgeText, category === cat && styles.catOptionBadgeActiveText]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {category === 'Other' && (
                <View>
                  <Text style={styles.inputLabel}>Specify Custom Category *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    placeholder="Enter custom category title"
                  />
                </View>
              )}
            </View>

            {/* Campaign Timeline / Limits */}
            <View style={styles.builderCard}>
              <Text style={styles.cardSectionHeader}>Duration & Control Settings</Text>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.rowInputs}>
                {['Draft', 'Published', 'Closed'].map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusSelectBtn, status === st && styles.statusSelectBtnActive]}
                    onPress={() => setStatus(st as any)}
                  >
                    <Text style={[styles.statusSelectText, status === st && styles.statusSelectTextActive]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Submission Limit (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={submissionLimit}
                onChangeText={setSubmissionLimit}
                placeholder="No limit (leave empty)"
                keyboardType="numeric"
              />

               <Text style={styles.inputLabel}>Registration ID Prefix</Text>
              <TextInput
                style={styles.textInput}
                value={regIdPrefix}
                onChangeText={setRegIdPrefix}
                placeholder="e.g. VAX-2026"
              />

              <Text style={styles.inputLabel}>Assign Diagnostic Test Template</Text>
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f8fafc',
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onPress={() => {
                  Alert.alert(
                    'Select Test Template',
                    'Choose diagnostic test for this campaign:',
                    [
                      { text: 'None / Standard', onPress: () => setTestTemplateId('') },
                      ...templatesList.map(t => ({
                        text: t.title,
                        onPress: () => setTestTemplateId(String(t.id))
                      })),
                      { text: 'Cancel', style: 'cancel' }
                    ]
                  );
                }}
              >
                <Text style={{ fontSize: 13, color: '#1e293b', fontWeight: '600' }}>
                  {testTemplateId ? templatesList.find(t => String(t.id) === testTemplateId)?.title || 'Assigned' : 'None / Standard'}
                </Text>
                <Text style={{ fontSize: 10, color: '#64748b' }}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Thank You message</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                value={thankYouMessage}
                onChangeText={setThankYouMessage}
                placeholder="Custom confirmation message shown to user..."
                multiline
              />
            </View>
          </View>
        ) : (
          <View style={styles.tabBody}>
            {/* Fields Editor list */}
            {fields.map((item, index) => (
              <View key={item._key} style={styles.fieldCard}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.fieldIndexLabel}>Field #{index + 1}</Text>
                  <View style={styles.fieldActionRow}>
                    <TouchableOpacity onPress={() => moveField(index, 'up')}>
                      <Text style={styles.arrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveField(index, 'down')}>
                      <Text style={styles.arrowText}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteField(index)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Field Label *</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.label}
                  onChangeText={(val) => updateField(index, 'label', val)}
                  placeholder="e.g. Enter Aadhaar ID"
                />

                <Text style={styles.inputLabel}>Placeholder (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={item.placeholder}
                  onChangeText={(val) => updateField(index, 'placeholder', val)}
                  placeholder="e.g. Type here..."
                />

                <Text style={styles.inputLabel}>Field Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fieldTypeScroller}>
                  {fieldTypes.map(ft => (
                    <TouchableOpacity
                      key={ft}
                      style={[styles.typeBadge, item.field_type === ft && styles.typeBadgeActive]}
                      onPress={() => updateField(index, 'field_type', ft)}
                    >
                      <Text style={[styles.typeBadgeText, item.field_type === ft && styles.typeBadgeActiveText]}>
                        {ft}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Choices for options-based fields */}
                {['Dropdown', 'Radio Button', 'Checkbox', 'Multi Select'].includes(item.field_type) && (
                  <View style={styles.optionsBlock}>
                    <View style={styles.optionsHeader}>
                      <Text style={styles.optionsTitle}>Config Options</Text>
                      <TouchableOpacity onPress={() => addFieldOption(index)}>
                        <Text style={styles.addOptionText}>+ Add Option</Text>
                      </TouchableOpacity>
                    </View>
                    {(item.options || []).map((opt: string, optIndex: number) => (
                      <View key={optIndex} style={styles.optionInputRow}>
                        <TextInput
                          style={styles.optionInput}
                          value={opt}
                          onChangeText={(val) => updateFieldOption(index, optIndex, val)}
                        />
                        <TouchableOpacity onPress={() => deleteFieldOption(index, optIndex)}>
                          <Text style={styles.removeOptionText}>❌</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.requiredRow}>
                  <Text style={styles.requiredLabel}>Mark field as mandatory?</Text>
                  <Switch
                    value={item.is_required}
                    onValueChange={(val) => updateField(index, 'is_required', val)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addFieldBigBtn} onPress={addField}>
              <Text style={styles.addFieldBigText}>+ Add Custom Question Field</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Save Button Bar */}
      <View style={styles.saveBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEditMode ? 'Save Changes' : 'Publish Campaign'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#4f46e5',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: '#4f46e5',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabBody: {
    gap: 16,
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
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
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
  catOptionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  catOptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catOptionBadgeActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#818cf8',
  },
  catOptionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catOptionBadgeActiveText: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  statusSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusSelectBtnActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#4f46e5',
  },
  statusSelectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  statusSelectTextActive: {
    color: '#4f46e5',
  },
  fieldCard: {
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
    marginBottom: 12,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  fieldIndexLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1e293b',
  },
  fieldActionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 14,
    color: '#64748b',
  },
  deleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  fieldTypeScroller: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeBadgeActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  typeBadgeActiveText: {
    color: '#ffffff',
  },
  optionsBlock: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  addOptionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#1e293b',
  },
  removeOptionText: {
    fontSize: 10,
  },
  requiredRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  requiredLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  addFieldBigBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  addFieldBigText: {
    color: '#4f46e5',
    fontSize: 13,
    fontWeight: '800',
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
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
