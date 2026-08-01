import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SvgIcon } from './SvgIcon';
import { styles } from '../styles/theme';
import { Campaign } from './CampaignsScreen';

export interface CampaignField {
  field_name: string;
  field_type: string;
  label: string;
  is_required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
}

export interface RegistrationFormScreenProps {
  selectedCampaign: Campaign;
  fields: CampaignField[];
  formValues: Record<string, any>;
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  validationErrors: Record<string, string>;
  uploadingField: Record<string, boolean>;
  submitting: boolean;
  handleSubmitForm: () => void;
  setCurrentScreen: (screen: 'CONFIG_LOGIN' | 'CAMPAIGNS' | 'FORM' | 'SUCCESS') => void;
  handleSelectFile: (fieldName: string, useCamera: boolean, isMultiple?: boolean) => void;
  removeUploadedFile: (fieldName: string, fileUrl?: string, isMultiple?: boolean) => void;
  handleChoiceChange: (fieldName: string, option: string, isChecked: boolean, isMulti: boolean) => void;
  
  setActiveAadharField: (val: string | null) => void;
  setFrontImageUri: (val: string | null) => void;
  setBackImageUri: (val: string | null) => void;
  setIsAadharModalOpen: (val: boolean) => void;
  
  setActiveSignatureField: (val: string | null) => void;
  setSignaturePaths: (val: string[][]) => void;
  setIsSignatureModalOpen: (val: boolean) => void;
  
  triggerAadharExtraction: (uploadedFiles: any[]) => void;
  ocrLoading: boolean;
}

export const RegistrationFormScreen: React.FC<RegistrationFormScreenProps> = ({
  selectedCampaign,
  fields,
  formValues,
  setFormValues,
  validationErrors,
  uploadingField,
  submitting,
  handleSubmitForm,
  setCurrentScreen,
  handleSelectFile,
  removeUploadedFile,
  handleChoiceChange,
  
  setActiveAadharField,
  setFrontImageUri,
  setBackImageUri,
  setIsAadharModalOpen,
  
  setActiveSignatureField,
  setSignaturePaths,
  setIsSignatureModalOpen,
  
  triggerAadharExtraction,
  ocrLoading,
}) => {
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Sub-Header bar */}
      <View style={styles.subHeaderBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentScreen('CAMPAIGNS')}>
          <SvgIcon type="back" color="#1e293b" size={20} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle} numberOfLines={1}>
          Register: {selectedCampaign.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.formTitle}>Participant Details</Text>
        <Text style={styles.formSubtitle}>Fill the dynamic screening fields below. Fields with * are required.</Text>

        {fields.map(f => {
          const error = validationErrors[f.field_name];
          const value = formValues[f.field_name];
          const isUploading = uploadingField[f.field_name];

          const labelLower = (f.label || '').toLowerCase();
          const isAadharField = labelLower.includes('aadhar') || labelLower.includes('aadhaar') || f.field_type === 'Aadhaar Number';

          return (
            <View key={f.field_name} style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                {f.label}
                {f.is_required && <Text style={styles.requiredStar}> *</Text>}
              </Text>

              {f.description && (
                <Text style={styles.fieldDesc}>{f.description}</Text>
              )}

              {/* 1. Single Line, Email, URL, Aadhaar, PAN inputs */}
              {['Single Line Text', 'Email', 'URL', 'Aadhaar Number', 'PAN Number'].includes(f.field_type) && (
                <TextInput
                  style={[styles.textInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder={f.placeholder || 'Enter input...'}
                  keyboardType={f.field_type === 'Email' ? 'email-address' : f.field_type === 'Aadhaar Number' ? 'numeric' : 'default'}
                  autoCapitalize="none"
                />
              )}

              {/* 2. Number, Age inputs */}
              {['Number', 'Age'].includes(f.field_type) && (
                <TextInput
                  style={[styles.textInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder={f.placeholder || 'Enter number...'}
                  keyboardType="numeric"
                />
              )}

              {/* 3. Text area inputs */}
              {['Multi Line Text', 'Address'].includes(f.field_type) && (
                <TextInput
                  style={[styles.textAreaInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder={f.placeholder || 'Enter details...'}
                  multiline
                  numberOfLines={3}
                />
              )}

              {/* 4. Date input */}
              {f.field_type === 'Date' && (
                <TextInput
                  style={[styles.textInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder="YYYY-MM-DD"
                />
              )}

              {/* 5. Time input */}
              {f.field_type === 'Time' && (
                <TextInput
                  style={[styles.textInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder="HH:MM (24h)"
                />
              )}

              {/* 6. Phone number input */}
              {f.field_type === 'Phone Number' && (
                <TextInput
                  style={[styles.textInput, error ? styles.inputErrorBorder : null]}
                  value={value || ''}
                  onChangeText={txt => setFormValues(prev => ({ ...prev, [f.field_name]: txt }))}
                  placeholder="+91 XXXXX-XXXXX"
                  keyboardType="phone-pad"
                />
              )}

              {/* 7. Yes/No Segment Choice Buttons */}
              {f.field_type === 'Yes/No Field' && (
                <View style={styles.yesNoContainer}>
                  {['Yes', 'No'].map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yesNoBtn,
                        value === y ? styles.yesNoBtnActive : null
                      ]}
                      onPress={() => setFormValues(prev => ({ ...prev, [f.field_name]: y }))}
                    >
                      <Text style={[styles.yesNoText, value === y ? styles.yesNoTextActive : null]}>
                        {y}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 8. Gender Segment Buttons */}
              {f.field_type === 'Gender' && (
                <View style={styles.genderContainer}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderBtn,
                        value === g ? styles.genderBtnActive : null
                      ]}
                      onPress={() => setFormValues(prev => ({ ...prev, [f.field_name]: g }))}
                    >
                      <Text style={[styles.genderText, value === g ? styles.genderTextActive : null]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 9. Dropdown Select */}
              {f.field_type === 'Dropdown' && (
                <View style={styles.dropdownPickerBorder}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceOptionsList}>
                    {f.options?.map((opt, oIdx) => (
                      <TouchableOpacity
                        key={oIdx}
                        style={[
                          styles.chipOptionBtn,
                          value === opt ? styles.chipOptionBtnActive : null
                        ]}
                        onPress={() => setFormValues(prev => ({ ...prev, [f.field_name]: opt }))}
                      >
                        <Text style={[styles.chipOptionText, value === opt ? styles.chipOptionTextActive : null]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 10. Checkbox & Multi Select checklist */}
              {['Checkbox', 'Multi Select'].includes(f.field_type) && (
                <View style={styles.multiChoiceWrapper}>
                  {f.options?.map((opt, oIdx) => {
                    const isTicked = Array.isArray(value) && value.includes(opt);
                    return (
                      <TouchableOpacity
                        key={oIdx}
                        style={styles.checkboxRow}
                        onPress={() => handleChoiceChange(f.field_name, opt, !isTicked, true)}
                      >
                        <View style={[styles.checkboxTick, isTicked ? styles.checkboxTickActive : null]}>
                          {isTicked && <SvgIcon type="check" color="#ffffff" size={12} />}
                        </View>
                        <Text style={styles.checkboxText}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Reveal Other field if checked */}
                  {Array.isArray(value) && value.includes('Other') && (
                    <TextInput
                      style={styles.textInput}
                      value={formValues[`__other_${f.field_name}`] || ''}
                      onChangeText={txt => setFormValues(prev => ({ ...prev, [`__other_${f.field_name}`]: txt }))}
                      placeholder="Please specify other option details..."
                    />
                  )}
                </View>
              )}

              {/* 11. Image & Document Uploads (Single) */}
              {['Single Image Upload', 'Single PDF Upload', 'File Upload', 'Click Photo'].includes(f.field_type) && (
                <View style={styles.uploadContainer}>
                  {value && value.url ? (
                    <View style={styles.uploadedFileBar}>
                      <Text style={styles.uploadedFileName} numberOfLines={1}>
                        📄 {value.originalname || 'file_uploaded.jpg'}
                      </Text>
                      <TouchableOpacity onPress={() => removeUploadedFile(f.field_name)} style={styles.deleteFileBtn}>
                        <SvgIcon type="trash" color="#ef4444" size={16} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {isUploading ? (
                        <View style={styles.uploadProgressBox}>
                          <ActivityIndicator size="small" color="#4f46e5" />
                          <Text style={styles.uploadProgressText}>Uploading file to camp server...</Text>
                        </View>
                      ) : (
                        <View style={styles.uploadActionRow}>
                          <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSelectFile(f.field_name, true)}>
                            <SvgIcon type="camera" color="#4f46e5" size={16} />
                            <Text style={styles.uploadBtnText}>Camera</Text>
                          </TouchableOpacity>

                          <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSelectFile(f.field_name, false)}>
                            <SvgIcon type="upload" color="#4f46e5" size={16} />
                            <Text style={styles.uploadBtnText}>Gallery</Text>
                          </TouchableOpacity>

                          {isAadharField && (
                            <TouchableOpacity 
                              style={styles.scanAadharBtn} 
                              onPress={() => {
                                setActiveAadharField(f.field_name);
                                setFrontImageUri(null);
                                setBackImageUri(null);
                                setIsAadharModalOpen(true);
                              }}
                            >
                              <SvgIcon type="sparkles" color="#ffffff" size={14} />
                              <Text style={styles.scanAadharText}>Scan Aadhaar Card (OCR)</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* 11.1 Image & Document Uploads (Multiple) */}
              {['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type) && (
                <View style={styles.uploadContainer}>
                  {/* Render already uploaded files list */}
                  {Array.isArray(value) && value.length > 0 && (
                    <View style={{ gap: 8, marginBottom: 8 }}>
                      {value.map((fileObj: any, fIdx: number) => (
                        <View key={fileObj.url || fIdx} style={styles.uploadedFileBar}>
                          <Text style={styles.uploadedFileName} numberOfLines={1}>
                            📄 {fileObj.originalname || 'file.jpg'}
                          </Text>
                          <TouchableOpacity onPress={() => removeUploadedFile(f.field_name, fileObj.url, true)} style={styles.deleteFileBtn}>
                            <SvgIcon type="trash" color="#ef4444" size={16} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Trigger Aadhaar details extraction if we have files uploaded and it is an Aadhaar field */}
                  {isAadharField && Array.isArray(value) && value.length > 0 && (
                    <TouchableOpacity
                      style={[styles.scanAadharBtn, { marginBottom: 8, width: '100%', justifyContent: 'center' }]}
                      onPress={() => triggerAadharExtraction(value)}
                      disabled={ocrLoading}
                    >
                      <SvgIcon type="sparkles" color="#ffffff" size={14} />
                      <Text style={styles.scanAadharText}>
                        {ocrLoading ? 'Extracting details...' : 'Done & Extract Aadhaar Details'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {isUploading ? (
                    <View style={styles.uploadProgressBox}>
                      <ActivityIndicator size="small" color="#4f46e5" />
                      <Text style={styles.uploadProgressText}>Uploading file to camp server...</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadActionRow}>
                      <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSelectFile(f.field_name, true, true)}>
                        <SvgIcon type="camera" color="#4f46e5" size={16} />
                        <Text style={styles.uploadBtnText}>Camera</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.uploadBtn} onPress={() => handleSelectFile(f.field_name, false, true)}>
                        <SvgIcon type="upload" color="#4f46e5" size={16} />
                        <Text style={styles.uploadBtnText}>Gallery</Text>
                      </TouchableOpacity>

                      {isAadharField && (
                        <TouchableOpacity 
                          style={styles.scanAadharBtn} 
                          onPress={() => {
                            setActiveAadharField(f.field_name);
                            setFrontImageUri(null);
                            setBackImageUri(null);
                            setIsAadharModalOpen(true);
                          }}
                        >
                          <SvgIcon type="sparkles" color="#ffffff" size={14} />
                          <Text style={styles.scanAadharText}>Scan Aadhaar Card (OCR)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* 12. Signature Upload */}
              {f.field_type === 'Signature Upload' && (
                <View style={styles.uploadContainer}>
                  {value && value.url ? (
                    <View style={styles.uploadedFileBar}>
                      <Text style={styles.uploadedFileName} numberOfLines={1}>
                        ✍️ Hand-written Signature Captured
                      </Text>
                      <TouchableOpacity onPress={() => removeUploadedFile(f.field_name)} style={styles.deleteFileBtn}>
                        <Text style={styles.redrawText}>Redraw</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.signaturePadTrigger}
                      onPress={() => {
                        setActiveSignatureField(f.field_name);
                        setSignaturePaths([]);
                        setIsSignatureModalOpen(true);
                      }}
                    >
                      <SvgIcon type="pen" color="#4f46e5" size={16} />
                      <Text style={styles.signatureTriggerText}>Draw signature inside pad</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          );
        })}

        {/* Submit Action */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitForm} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Participant Registration</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
