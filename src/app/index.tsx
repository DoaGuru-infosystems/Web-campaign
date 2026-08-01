import React, { useState, useEffect } from 'react';
import { Alert, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

// Shared styling and utilities
import { styles } from '../styles/theme';
import { API_CALLS } from '../utils/api';
import { OfflineManager } from '../utils/offline';

// Decoupled screens and modals
import { ConfigLoginScreen } from '../components/ConfigLoginScreen';
import { CampaignsScreen, Campaign } from '../components/CampaignsScreen';
import { RegistrationFormScreen, CampaignField } from '../components/RegistrationFormScreen';
import { SuccessReceiptScreen } from '../components/SuccessReceiptScreen';
import { AadharScannerModal } from '../components/AadharScannerModal';
import { SignaturePadModal } from '../components/SignaturePadModal';
import { DashboardScreen } from '../components/DashboardScreen';
import { CreateCampaignScreen } from '../components/CreateCampaignScreen';
import { AllEntriesScreen } from '../components/AllEntriesScreen';
import { NavigationDrawer } from '../components/NavigationDrawer';
import { CampaignDetailsScreen } from '../components/CampaignDetailsScreen';
import { SettingsScreen } from '../components/SettingsScreen';
import { ReportsScreen } from '../components/ReportsScreen';
import { TestTemplatesScreen } from '../components/TestTemplatesScreen';
import { DiagnosticTestFormScreen } from '../components/DiagnosticTestFormScreen';
import { RegisteredPatientsScreen } from '../components/RegisteredPatientsScreen';
import { ReferralTravelScreen } from '../components/ReferralTravelScreen';

export default function HomeScreen() {
  const [currentScreen, setCurrentScreen] = useState<'CONFIG_LOGIN' | 'DASHBOARD' | 'CAMPAIGNS' | 'FORM' | 'SUCCESS' | 'CREATE_CAMPAIGN' | 'ALL_ENTRIES' | 'CAMPAIGN_DETAILS' | 'SETTINGS' | 'REPORTS' | 'TEST_TEMPLATES' | 'DIAGNOSTIC_TEST' | 'REGISTERED_PATIENTS' | 'REFERRAL_TRAVEL'>('CONFIG_LOGIN');
  const [activeTestRegId, setActiveTestRegId] = useState<string>('');
  const [testReturnScreen, setTestReturnScreen] = useState<'FORM' | 'REGISTERED_PATIENTS' | 'ALL_ENTRIES'>('FORM');
  const [serverUrl, setServerUrl] = useState('http://192.168.1.8:5001');
  const [apiKey, setApiKey] = useState('K81053144988957');
  const [showConfig, setShowConfig] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Authentication States
  const [email, setEmail] = useState('admin@campaignflow.com');
  const [password, setPassword] = useState('adminpassword');
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);

  // Drawer / Sub-Screen Selection
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [campaignIdToEdit, setCampaignIdToEdit] = useState<number | null>(null);

  // Campaigns Lists
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [fields, setFields] = useState<CampaignField[]>([]);
  const [searchVal, setSearchVal] = useState('');

  // Form Values States
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Loading Statuses
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // File Upload Trackers
  const [uploadingField, setUploadingField] = useState<Record<string, boolean>>({});

  // Submission Success Receipts
  const [submitReceipt, setSubmitReceipt] = useState<{ registrationId: string; thankYouMessage: string } | null>(null);

  // OCR Dual Capture State
  const [isAadharModalOpen, setIsAadharModalOpen] = useState(false);
  const [frontImageUri, setFrontImageUri] = useState<string | null>(null);
  const [backImageUri, setBackImageUri] = useState<string | null>(null);
  const [activeAadharField, setActiveAadharField] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');

  // Signature Pad State
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [activeSignatureField, setActiveSignatureField] = useState<string | null>(null);
  const [signaturePaths, setSignaturePaths] = useState<string[][]>([]);
  const [currentSignaturePath, setCurrentSignaturePath] = useState<string[]>([]);

  // Load configured keys on Mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        let savedUrl = await AsyncStorage.getItem('SERVER_BASE_URL');
        const savedKey = await AsyncStorage.getItem('OCR_SPACE_API_KEY');
        const savedToken = await AsyncStorage.getItem('AUTH_TOKEN');
        const savedUser = await AsyncStorage.getItem('AUTH_USER');

        if (savedUrl) {
          if (savedUrl.includes(':5000')) {
            savedUrl = savedUrl.replace(':5000', ':5001');
          }
          if (savedUrl.includes('192.168.1.31')) {
            savedUrl = savedUrl.replace('192.168.1.31', '192.168.1.8');
          }
          await AsyncStorage.setItem('SERVER_BASE_URL', savedUrl);
          setServerUrl(savedUrl);
        }
        if (savedKey && savedKey !== 'helloworld') {
          setApiKey(savedKey);
        } else {
          await AsyncStorage.setItem('OCR_SPACE_API_KEY', 'K81053144988957');
          setApiKey('K81053144988957');
        }
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          setCurrentScreen('DASHBOARD');
        }
      } catch (e) {
        console.log('Failed to restore config settings');
      }
    };
    initializeSettings();
  }, []);

  const updateUnsyncedCounts = async () => {
    try {
      const regs = await OfflineManager.getOfflineRegistrations();
      const tests = await OfflineManager.getOfflineTests();
      setUnsyncedCount(regs.length + tests.length);
    } catch (_) {}
  };

  useEffect(() => {
    updateUnsyncedCounts();
  }, [currentScreen]);

  const handleSyncOfflineData = async () => {
    if (syncing) return;
    setSyncing(true);
    setLoading(true);
    setLoadingText('Synchronizing offline database...');
    try {
      const res = await OfflineManager.syncOfflineData(serverUrl, token, (msg) => {
        setLoadingText(msg);
      });
      
      await updateUnsyncedCounts();
      
      if (res.success) {
        Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} records successfully.`);
        setIsOfflineMode(false);
        loadCampaigns(true);
      } else {
        Alert.alert('Sync Completed with Errors', `Some records could not be synchronized:\n${res.errors.join('\n')}`);
      }
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message || 'Failed to sync offline data.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Save base URL and API Key
  const handleSaveConfig = async () => {
    try {
      let url = serverUrl.trim();
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      await AsyncStorage.setItem('SERVER_BASE_URL', url);
      await AsyncStorage.setItem('OCR_SPACE_API_KEY', apiKey.trim());
      setServerUrl(url);
      Alert.alert('Configuration Saved', 'Server URL & OCR credentials updated.');
      setShowConfig(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save configuration details.');
    }
  };

  // Perform Server Login
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your username/password.');
      return;
    }

    setLoading(true);
    setLoadingText('Authenticating server...');
    try {
      const data = await API_CALLS.post('/auth/login', { email: email.trim(), password }, serverUrl);
      if (data.token) {
        await AsyncStorage.setItem('AUTH_TOKEN', data.token);
        await AsyncStorage.setItem('AUTH_USER', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setCurrentScreen('DASHBOARD');
      } else {
        throw new Error('No authentication token returned.');
      }
    } catch (err: any) {
      // console.error(err);
      Alert.alert('Authentication Failed', err.message || 'Check email, password, and connection base URL.');
    } finally {
      setLoading(false);
    }
  };

  // Load Campaigns
  const loadCampaigns = async (preventAutoSync = false) => {
    setLoading(true);
    setLoadingText('Loading active campaigns...');
    try {
      const data = await API_CALLS.get('/campaigns', serverUrl, token);
      setCampaigns(data.campaigns || []);
      setIsOfflineMode(false);

      if (!preventAutoSync && !syncing) {
        const regs = await OfflineManager.getOfflineRegistrations();
        const tests = await OfflineManager.getOfflineTests();
        const totalUnsynced = regs.length + tests.length;
        if (totalUnsynced > 0) {
          setTimeout(() => {
            handleSyncOfflineData();
          }, 500);
        }
      }
    } catch (err: any) {
      const cached = await OfflineManager.getCachedCampaigns();
      if (cached.length > 0) {
        setCampaigns(cached);
        setIsOfflineMode(true);
        Alert.alert('Offline Mode Enabled', 'Unable to reach the server. Loaded offline-cached campaigns instead.');
      } else {
        Alert.alert('Connection Failed', 'Unable to fetch campaigns list. Try checking connection details.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Trigger Campaigns load when entering campaigns screen
  useEffect(() => {
    if ((currentScreen === 'CAMPAIGNS' || currentScreen === 'DASHBOARD') && token) {
      loadCampaigns();
    }
  }, [currentScreen, token]);

  // Handle Logout
  const handleLogout = async () => {
    await AsyncStorage.removeItem('AUTH_TOKEN');
    await AsyncStorage.removeItem('AUTH_USER');
    setToken('');
    setUser(null);
    setCurrentScreen('CONFIG_LOGIN');
  };

  // Select campaign to view details dashboard
  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCurrentScreen('CAMPAIGN_DETAILS');
  };

  // Retrieve dynamic form fields & start registration
  const handleStartRegistration = async (campaign: Campaign) => {
    setLoading(true);
    setLoadingText('Constructing camp registration form...');
    try {
      let fieldsData = [];
      let campaignObj = campaign;

      if (isOfflineMode) {
        fieldsData = await OfflineManager.getCachedCampaignFields(campaign.id);
        if (fieldsData.length === 0) {
          throw new Error('This campaign is not saved offline. Please save it while online first.');
        }
      } else {
        try {
          const data = await API_CALLS.get(`/campaigns/public/${campaign.id}`, serverUrl);
          fieldsData = data.fields;
          campaignObj = data.campaign;
        } catch (apiErr) {
          // fallback to offline fields if present
          fieldsData = await OfflineManager.getCachedCampaignFields(campaign.id);
          if (fieldsData.length > 0) {
            setIsOfflineMode(true);
            Alert.alert('Offline Mode Enabled', 'Unable to reach the server. Constructing form from offline cache.');
          } else {
            throw apiErr;
          }
        }
      }

      setSelectedCampaign(campaignObj);
      
      // Sort Aadhaar related fields to top to help user trigger scanner first
      const sortedFields = [...fieldsData].sort((a, b) => {
        const aLower = (a.label || '').toLowerCase();
        const bLower = (b.label || '').toLowerCase();
        const aIsAadhar = aLower.includes('aadhar') || aLower.includes('aadhaar') || a.field_type === 'Aadhaar Number';
        const bIsAadhar = bLower.includes('aadhar') || bLower.includes('aadhaar') || b.field_type === 'Aadhaar Number';
        if (aIsAadhar && !bIsAadhar) return -1;
        if (!aIsAadhar && bIsAadhar) return 1;
        return 0;
      });
      setFields(sortedFields);

      // Prepopulate form state with defaults
      const initialValues: Record<string, any> = {};
      fieldsData.forEach((f: CampaignField) => {
        if (['Checkbox', 'Multi Select'].includes(f.field_type)) {
          initialValues[f.field_name] = [];
        } else {
          initialValues[f.field_name] = '';
        }
      });
      setFormValues(initialValues);
      setValidationErrors({});
      setCurrentScreen('FORM');
    } catch (err: any) {
      Alert.alert('Form Retrieval Error', err.message || 'Unable to download campaign questions schema.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic choice selection (Checkbox / Multi Choice / radio buttons)
  const handleChoiceChange = (fieldName: string, val: string, isChecked: boolean, isMultiple: boolean) => {
    if (isMultiple) {
      const current = Array.isArray(formValues[fieldName]) ? [...formValues[fieldName]] : [];
      if (isChecked) {
        if (!current.includes(val)) current.push(val);
      } else {
        const index = current.indexOf(val);
        if (index > -1) current.splice(index, 1);
        if (val === 'Other') {
          setFormValues(prev => ({ ...prev, [fieldName]: current, [`__other_${fieldName}`]: '' }));
          return;
        }
      }
      setFormValues(prev => ({ ...prev, [fieldName]: current }));
    } else {
      setFormValues(prev => ({ ...prev, [fieldName]: val }));
    }
  };

  // Select photo upload or click camera
  const handleSelectFile = async (fieldName: string, useCamera = false, isMultiple = false) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', `Access is required to select image.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const localUri = asset.uri;
      
      let ext = 'jpg';
      if (asset.mimeType) {
        const parts = asset.mimeType.split('/');
        if (parts.length === 2) ext = parts[1];
      } else {
        const match = /\.(\w+)(?:\?.*)?$/.exec(localUri);
        if (match) ext = match[1];
      }
      if (ext === 'jpeg') ext = 'jpg';

      const filename = `upload_${Date.now()}.${ext}`;
      const mime = asset.mimeType || `image/${ext}`;

      setUploadingField(prev => ({ ...prev, [fieldName]: true }));
      try {
        let uploadedObj;
        if (isOfflineMode) {
          uploadedObj = {
            url: localUri,
            localUri,
            filename,
            mimetype: mime,
            size: 0,
            isOfflineFile: true
          };
        } else {
          const res = await API_CALLS.upload(localUri, filename, mime, serverUrl, token);
          uploadedObj = { ...res, localUri };
        }

        if (isMultiple) {
          setFormValues(prev => {
            const currentList = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
            return { ...prev, [fieldName]: [...currentList, uploadedObj] };
          });
        } else {
          setFormValues(prev => ({ ...prev, [fieldName]: uploadedObj }));
          
          // Trigger automatic Aadhaar extraction for single image upload if it's an Aadhaar field
          const targetField = fields.find(f => f.field_name === fieldName);
          const labelLower = (targetField?.label || '').toLowerCase();
          const fieldNameLower = fieldName.toLowerCase();
          const isAadharField = labelLower.includes('aadhar') || labelLower.includes('aadhaar') || fieldNameLower.includes('aadhar') || fieldNameLower.includes('aadhaar');
          if (isAadharField && uploadedObj.url && !isOfflineMode) {
            triggerAadharExtraction([uploadedObj]);
          }
        }
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message || 'File upload request rejected by server.');
      } finally {
        setUploadingField(prev => ({ ...prev, [fieldName]: false }));
      }
    }
  };

  // Clear uploaded file
  const removeUploadedFile = (fieldName: string, fileUrl?: string, isMultiple = false) => {
    if (isMultiple && fileUrl) {
      setFormValues(prev => {
        const currentList = Array.isArray(prev[fieldName]) ? prev[fieldName] : [];
        const filtered = currentList.filter((f: any) => f.url !== fileUrl);
        return { ...prev, [fieldName]: filtered };
      });
    } else {
      setFormValues(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  // Signature Pad Touches
  const handleSignatureTouchStart = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const newPoint = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
    setCurrentSignaturePath([newPoint]);
  };

  const handleSignatureTouchMove = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    const newPoint = `L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
    setCurrentSignaturePath(prev => [...prev, newPoint]);
  };

  const handleSignatureTouchEnd = () => {
    if (currentSignaturePath.length > 0) {
      setSignaturePaths(prev => [...prev, currentSignaturePath]);
      setCurrentSignaturePath([]);
    }
  };

  const handleClearSignature = () => {
    setSignaturePaths([]);
    setCurrentSignaturePath([]);
  };

  const handleSaveSignature = async () => {
    if (!activeSignatureField) return;
    if (signaturePaths.length === 0) {
      Alert.alert('Empty Pad', 'Please draw a signature before clicking save.');
      return;
    }

    setOcrLoading(true);
    setOcrMessage('Converting vector drawing and saving...');
    try {
      // Construct SVG string
      const svgContent = `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        ${signaturePaths.map(p => `<path d="${p.join(' ')}" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
      </svg>`;

      // Cache svg content in temporary directory
      const tempPath = (FileSystem.cacheDirectory || '') + `signature_${Date.now()}.svg`;
      await FileSystem.writeAsStringAsync(tempPath, svgContent, { encoding: FileSystem.EncodingType.UTF8 });

      // Upload SVG directly to backend upload endpoint
      let res;
      if (isOfflineMode) {
        res = {
          url: tempPath,
          localUri: tempPath,
          filename: `sig_${activeSignatureField}.svg`,
          mimetype: 'image/svg+xml',
          size: 0,
          isOfflineFile: true
        };
      } else {
        res = await API_CALLS.upload(tempPath, `sig_${activeSignatureField}.svg`, 'image/svg+xml', serverUrl, token);
      }
      
      setFormValues(prev => ({ ...prev, [activeSignatureField]: res }));
      setIsSignatureModalOpen(false);
      Alert.alert('Signature Captured', 'Hand-drawn signature saved successfully.');
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Signature upload failed.');
    } finally {
      setOcrLoading(false);
      setOcrMessage('');
    }
  };

  const handleCaptureOcrSide = async (side: 'front' | 'back', useCamera = false) => {
    const { status } = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera/gallery access is required to capture Aadhaar.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (side === 'front') setFrontImageUri(result.assets[0].uri);
      else setBackImageUri(result.assets[0].uri);
    }
  };

  // ── CLIENT-SIDE OCR HELPERS ──
  const parseAadharTextClientSide = (frontText: string, backText: string) => {
    const result: Record<string, string> = {
      name: '', dob: '', gender: '', aadharNumber: '',
      address: '', city: '', district: '', state: '', pincode: '',
    };

    if (frontText) {
      // 1. Aadhaar Number
      const aadhaarMatch = frontText.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
      if (aadhaarMatch) {
        result.aadharNumber = aadhaarMatch[0].replace(/[\s-]/g, '');
      }

      // 2. DOB
      const dobMatch = frontText.match(
        /(?:DOB|D\.O\.B|Date\s*of\s*Birth|जन्म)[:\s/-]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
      );
      if (dobMatch) {
        result.dob = dobMatch[1].replace(/-/g, '/');
      } else {
        const yobMatch = frontText.match(/(?:Year\s*of\s*Birth|YOB)[:\s]+(\d{4})/i);
        if (yobMatch) result.dob = `01/01/${yobMatch[1]}`;
      }

      // 3. Gender
      const genderExact = frontText.match(/\b(MALE|FEMALE|Transgender)\b/i);
      if (genderExact) {
        const g = genderExact[1].toUpperCase();
        result.gender = g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other';
      } else {
        for (const line of frontText.split('\n')) {
          const u = line.toUpperCase();
          if (/\bRAL\b|\bALE\b|\/\s*AL\b/.test(u)) { result.gender = 'Male'; break; }
          if (/EMALE|FEMA/.test(u)) { result.gender = 'Female'; break; }
        }
      }

      // 4. Name
      const SKIP = new Set([
        'government','india','authority','unique','identification',
        'aadhaar','aadhar','enrolment','enrollment','male','female',
        'address','dob','birth','date','year','of','help',
        'proof','identity','citizen','resident','qr','code',
      ]);

      const isNameCandidate = (line: string) => {
        const clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
        if (clean.length < 4) return false;
        if (!/^[a-zA-Z\s]+$/.test(clean)) return false;
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length < 2) return false;
        const useful = words.filter(w => !SKIP.has(w.toLowerCase()));
        return useful.length > 0;
      };

      const formatName = (raw: string) =>
        raw.replace(/[^a-zA-Z\s]/g, '').trim()
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

      const lines = frontText.split('\n').map(l => l.trim()).filter(Boolean);
      let dobLineIdx = lines.findIndex(l => /DOB|Date\s*of\s*Birth|जन्म/i.test(l));

      if (dobLineIdx > 0) {
        for (let off = 1; off <= Math.min(4, dobLineIdx); off++) {
          const cand = lines[dobLineIdx - off];
          if (isNameCandidate(cand)) { result.name = formatName(cand); break; }
        }
      }

      if (!result.name) {
        for (let i = 0; i < Math.min(12, lines.length); i++) {
          if (/^[A-Z][A-Z\s]{4,}$/.test(lines[i]) && isNameCandidate(lines[i])) {
            result.name = formatName(lines[i]);
            break;
          }
        }
      }

      if (!result.name) {
        for (let i = 0; i < Math.min(12, lines.length); i++) {
          if (isNameCandidate(lines[i])) { result.name = formatName(lines[i]); break; }
        }
      }
    }

    const backTextToUse = backText || frontText;
    if (backTextToUse) {
      let addrText = '';
      const lines = backTextToUse.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Flexible matching for address start (handles typos like Addess:, Addres:, etc.)
      const addrStartRegex = /(?:address|addess|addres|adderss|pata|पता|c\/o|s\/o|d\/o|w\/o)[:\s]+/i;
      const addrMatch = backTextToUse.match(addrStartRegex);
      
      if (addrMatch && addrMatch.index !== undefined) {
        addrText = backTextToUse.slice(addrMatch.index + addrMatch[0].length).trim();
      } else {
        const kwds = ['c/o','s/o','d/o','w/o','father','house','ward','village','dist'];
        const addrStart = lines.findIndex(l => kwds.some(k => l.toLowerCase().includes(k)));
        if (addrStart !== -1) {
          const addrLines = [];
          for (let i = addrStart; i < Math.min(lines.length, addrStart + 8); i++) {
            addrLines.push(lines[i]);
            if (/\b\d{6}\b/.test(lines[i])) break;
          }
          addrText = addrLines.join(', ');
        }
      }

      if (addrText) {
        const pinMatch = addrText.match(/\b(\d{6})\b/);
        if (pinMatch) {
          result.pincode = pinMatch[1];
          const pinIndex = addrText.indexOf(pinMatch[0]);
          if (pinIndex !== -1) {
            addrText = addrText.slice(0, pinIndex).trim();
          }
        }

        addrText = addrText.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

        const INDIAN_STATES = [
          'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
          'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
          'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
          'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
          'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 
          'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 
          'Lakshadweep', 'Puducherry'
        ];

        let matchedState = '';
        for (const state of INDIAN_STATES) {
          const stateRegexStr = '\\b' + state.replace(/\s+/g, '\\s*') + '\\b';
          const stateRegex = new RegExp(stateRegexStr, 'i');
          if (stateRegex.test(addrText)) {
            matchedState = state;
            addrText = addrText.replace(stateRegex, '').trim();
            break;
          }
        }
        result.state = matchedState;

        addrText = addrText.replace(/[\s-,\/]+$/, '').trim();

        let parts = addrText.split(',').map(p => p.trim()).filter(Boolean);

        const isCareOf = /^\s*(?:c\/o|s\/o|d\/o|w\/o|care\s*of|son\s*of|daughter\s*of|wife\s*of|pata|address|addess|addres|पता)[:\s]*/i;
        parts = parts
          .filter(part => !isCareOf.test(part))
          .map(p => p.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim())
          .filter(part => {
            const clean = part.replace(/[^a-zA-Z0-9]/g, '').trim();
            return clean.length > 0;
          });

        if (parts.length >= 3) {
          result.district = parts[parts.length - 1];
          result.city = parts[parts.length - 2];
          result.address = parts.slice(0, parts.length - 2).join(', ');
        } else if (parts.length === 2) {
          result.district = parts[1];
          result.city = parts[0];
          result.address = parts[0];
        } else if (parts.length === 1) {
          result.district = parts[0];
          result.city = parts[0];
          result.address = parts[0];
        }
      }
    }

    return result;
  };

  const getBase64ForFileObj = async (fileObj: any) => {
    let uri = fileObj.localUri;
    let tempFile = null;

    if (!uri && fileObj.url) {
      const fullUrl = fileObj.url.startsWith('http') 
        ? fileObj.url 
        : `${serverUrl}${fileObj.url}`;
      
      const filename = fileObj.filename || `temp_${Date.now()}.jpg`;
      const tempPath = `${FileSystem.cacheDirectory}${filename}`;
      
      console.log(`[OCR] Downloading image for OCR from: ${fullUrl}`);
      const downloadResult = await FileSystem.downloadAsync(fullUrl, tempPath);
      uri = downloadResult.uri;
      tempFile = tempPath;
    }

    if (!uri) {
      throw new Error('Image URI is not available.');
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (tempFile) {
      try {
        await FileSystem.deleteAsync(tempFile, { idempotent: true });
      } catch (_) {}
    }

    return base64;
  };

  const runOcrOnImage = async (uri: string) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const formData = new FormData();
      formData.append('apikey', apiKey || 'helloworld');
      formData.append('base64image', `data:image/jpeg;base64,${base64}`);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.IsErroredOnProcessing) {
        throw new Error(json.ErrorMessage?.[0] || 'OCR.space processing error');
      }

      return json.ParsedResults?.[0]?.ParsedText || '';
    } catch (e: any) {
      console.error('[OCR.space] Error:', e);
      throw e;
    }
  };

  const handleTriggerOcrExtraction = async () => {
    if (!frontImageUri && !backImageUri) {
      Alert.alert('Images Required', 'Please load at least one side (Front or Back) of the Aadhaar card.');
      return;
    }

    setOcrLoading(true);
    setOcrMessage('Extracting details using OCR.space Cloud API...');

    try {
      let frontText = '';
      let backText = '';

      if (frontImageUri) {
        setOcrMessage('Analyzing front side...');
        frontText = await runOcrOnImage(frontImageUri);
      }

      if (backImageUri) {
        setOcrMessage('Analyzing back side...');
        backText = await runOcrOnImage(backImageUri);
      }

      const details = parseAadharTextClientSide(frontText, backText);

      // Check if we actually extracted any values
      const extractedKeys = ['aadharNumber', 'name', 'dob', 'gender', 'address', 'city', 'district', 'state', 'pincode'];
      const hasData = details && extractedKeys.some(k => details[k] && String(details[k]).trim() !== '');

      if (!hasData) {
        Alert.alert('Extraction Failed', 'Could not extract details from the document. Please ensure the image is clear and readable.');
        return;
      }

      // Autofill matching fields in the dynamic form builder
      setFormValues(prev => {
        const updated = { ...prev };
        fields.forEach(f => {
          const fLabelLower = (f.label || '').toLowerCase();
          const fNameLower = (f.field_name || '').toLowerCase();

          // 1. Aadhaar Number
          if (fLabelLower.includes('aadhar') || fLabelLower.includes('aadhaar') || f.field_type === 'Aadhaar Number') {
            if (details.aadharNumber) {
              updated[f.field_name] = details.aadharNumber;
            }
          }
          // 2. Name
          else if (
            (fLabelLower.includes('name') || fNameLower.includes('name')) &&
            !/father|mother|spouse|husband|wife|doctor|guardian|nominee/i.test(fLabelLower)
          ) {
            if (details.name) {
              updated[f.field_name] = details.name;
            }
          }
          // 3. DOB
          else if (fLabelLower.includes('dob') || fLabelLower.includes('birth') || fNameLower.includes('dob')) {
            if (details.dob) {
              if (['Date', 'Date Field'].includes(f.field_type) && details.dob.includes('/')) {
                const parts = details.dob.split('/');
                if (parts.length === 3) {
                  updated[f.field_name] = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                  updated[f.field_name] = details.dob;
                }
              } else {
                updated[f.field_name] = details.dob;
              }
            }
          }
          // 4. Gender
          else if (fLabelLower.includes('gender') || fLabelLower.includes('sex')) {
            if (details.gender) {
              const gLower = details.gender.toLowerCase();
              if (gLower.includes('f')) updated[f.field_name] = 'Female';
              else if (gLower.includes('m')) updated[f.field_name] = 'Male';
              else updated[f.field_name] = details.gender;
            }
          }
          // 5. Address
          else if (fLabelLower.includes('address') || fNameLower.includes('address')) {
            if (details.address) {
              updated[f.field_name] = details.address;
            }
          }
          // 6. City
          else if (fLabelLower.includes('city') || fNameLower.includes('city')) {
            if (details.city) {
              updated[f.field_name] = details.city;
            }
          }
          // 7. District
          else if (fLabelLower.includes('district') || fNameLower.includes('district')) {
            if (details.district) {
              updated[f.field_name] = details.district;
            }
          }
          // 8. State
          else if (fLabelLower.includes('state') || fNameLower.includes('state')) {
            if (details.state) {
              updated[f.field_name] = details.state;
            }
          }
          // 9. Pincode
          else if (fLabelLower.includes('pincode') || fLabelLower.includes('pin') || fNameLower.includes('pincode')) {
            if (details.pincode) {
              updated[f.field_name] = details.pincode;
            }
          }
        });
        return updated;
      });

      // Upload Front image to backend just to get the resource reference for the form state
      if (frontImageUri && activeAadharField) {
        setOcrMessage('Saving image reference on server...');
        let ext = 'jpg';
        const match = /\.(\w+)(?:\?.*)?$/.exec(frontImageUri);
        if (match) ext = match[1];
        if (ext === 'jpeg') ext = 'jpg';

        const filename = `front_aadhar_${Date.now()}.${ext}`;
        const mime = `image/${ext}`;

        const res = await API_CALLS.upload(frontImageUri, filename, mime, serverUrl, token);
        setFormValues(prev => ({ ...prev, [activeAadharField]: res }));
      }

      Alert.alert('Scan Successful', 'Aadhaar data extracted and corresponding fields populated.');
      setIsAadharModalOpen(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Scan Failed', err.message || 'Could not parse Aadhaar images.');
    } finally {
      setOcrLoading(false);
      setOcrMessage('');
    }
  };

  const triggerAadharExtraction = async (uploadedFiles: any) => {
    const filesArray = Array.isArray(uploadedFiles) 
      ? uploadedFiles 
      : (uploadedFiles ? [uploadedFiles] : []);

    if (filesArray.length === 0) return;

    setOcrLoading(true);
    setOcrMessage('Extracting Aadhaar details via OCR.space Cloud API...');

    try {
      let combinedText = '';

      for (let i = 0; i < filesArray.length; i++) {
        setOcrMessage(`Analyzing image ${i + 1} of ${filesArray.length}...`);
        const fileObj = filesArray[i];
        const base64 = await getBase64ForFileObj(fileObj);

        const formData = new FormData();
        formData.append('apikey', apiKey || 'helloworld');
        formData.append('base64image', `data:image/jpeg;base64,${base64}`);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2');

        const res = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();
        console.log('[OCR.space RAW RESPONSE]', JSON.stringify(json, null, 2));

        if (json.IsErroredOnProcessing) {
          throw new Error(json.ErrorMessage?.[0] || 'OCR.space processing error');
        }

        const text = json.ParsedResults?.[0]?.ParsedText || '';
        combinedText += '\n' + text;
      }

      const details = parseAadharTextClientSide(combinedText, combinedText);

      const extractedKeys = ['aadharNumber', 'name', 'dob', 'gender', 'address', 'city', 'district', 'state', 'pincode'];
      const hasData = details && extractedKeys.some(k => details[k] && String(details[k]).trim() !== '');

      if (!hasData) {
        Alert.alert('Extraction Failed', 'Could not extract details from the document. Please ensure the image is clear and readable.');
        return;
      }

      setFormValues(prev => {
        const updated = { ...prev };
        fields.forEach(f => {
          const fLabelLower = (f.label || '').toLowerCase();
          const fNameLower = (f.field_name || '').toLowerCase();

          // 1. Aadhaar Number
          if (fLabelLower.includes('aadhar') || fLabelLower.includes('aadhaar') || f.field_type === 'Aadhaar Number') {
            if (details.aadharNumber) {
              updated[f.field_name] = details.aadharNumber;
            }
          }
          // 2. Name
          else if (
            (fLabelLower.includes('name') || fNameLower.includes('name')) &&
            !/father|mother|spouse|husband|wife|doctor|guardian|nominee/i.test(fLabelLower)
          ) {
            if (details.name) {
              updated[f.field_name] = details.name;
            }
          }
          // 3. DOB
          else if (fLabelLower.includes('dob') || fLabelLower.includes('birth') || fNameLower.includes('dob')) {
            if (details.dob) {
              if (['Date', 'Date Field'].includes(f.field_type) && details.dob.includes('/')) {
                const parts = details.dob.split('/');
                if (parts.length === 3) {
                  updated[f.field_name] = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                  updated[f.field_name] = details.dob;
                }
              } else {
                updated[f.field_name] = details.dob;
              }
            }
          }
          // 4. Gender
          else if (fLabelLower.includes('gender') || fLabelLower.includes('sex')) {
            if (details.gender) {
              const gLower = details.gender.toLowerCase();
              if (gLower.includes('f')) updated[f.field_name] = 'Female';
              else if (gLower.includes('m')) updated[f.field_name] = 'Male';
              else updated[f.field_name] = details.gender;
            }
          }
          // 5. Address
          else if (fLabelLower.includes('address') || fNameLower.includes('address')) {
            if (details.address) {
              updated[f.field_name] = details.address;
            }
          }
          // 6. City
          else if (fLabelLower.includes('city') || fNameLower.includes('city')) {
            if (details.city) {
              updated[f.field_name] = details.city;
            }
          }
          // 7. District
          else if (fLabelLower.includes('district') || fNameLower.includes('district')) {
            if (details.district) {
              updated[f.field_name] = details.district;
            }
          }
          // 8. State
          else if (fLabelLower.includes('state') || fNameLower.includes('state')) {
            if (details.state) {
              updated[f.field_name] = details.state;
            }
          }
          // 9. Pincode
          else if (fLabelLower.includes('pincode') || fLabelLower.includes('pin') || fNameLower.includes('pincode')) {
            if (details.pincode) {
              updated[f.field_name] = details.pincode;
            }
          }
        });
        return updated;
      });

      Alert.alert('Scan Successful', 'Aadhaar data extracted and corresponding fields populated.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Scan Failed', err.message || 'Could not parse Aadhaar images.');
    } finally {
      setOcrLoading(false);
      setOcrMessage('');
    }
  };

  // Submit dynamic form
  const handleSubmitForm = async () => {
    setValidationErrors({});
    const errors: Record<string, string> = {};

    fields.forEach(f => {
      const val = formValues[f.field_name];
      if (f.is_required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
        errors[f.field_name] = `${f.label} is required.`;
      }
      if (Array.isArray(val) && val.includes('Other')) {
        const otherText = (formValues[`__other_${f.field_name}`] || '').trim();
        if (!otherText) {
          errors[f.field_name] = `Please specify other text for ${f.label}.`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert('Validation Error', 'Please correct the validation items in the form before submitting.');
      return;
    }

    const cleanData: Record<string, any> = {};
    Object.entries(formValues).forEach(([k, val]) => {
      if (k.startsWith('__other_')) return;
      if (Array.isArray(val) && val.includes('Other')) {
        const otherText = (formValues[`__other_${k}`] || '').trim();
        cleanData[k] = val.map(v => (v === 'Other' ? otherText : v));
      } else {
        cleanData[k] = val;
      }
    });

    setSubmitting(true);
    try {
      if (isOfflineMode) {
        const offlineId = await OfflineManager.queueRegistration(selectedCampaign?.id!, cleanData);
        setSubmitReceipt({
          registrationId: offlineId,
          thankYouMessage: 'Registration saved locally. It will be uploaded to the server once you sync.',
        });
        setCurrentScreen('SUCCESS');
        updateUnsyncedCounts();
      } else {
        const res = await API_CALLS.post('/registrations', {
          campaign_id: selectedCampaign?.id,
          submitted_data: cleanData,
        }, serverUrl, token);

        setSubmitReceipt({
          registrationId: res.registration_id,
          thankYouMessage: res.thank_you_message || 'Thank you for submitting!',
        });
        setCurrentScreen('SUCCESS');
      }
    } catch (err: any) {
      const isCached = selectedCampaign ? await OfflineManager.isCampaignOffline(selectedCampaign.id) : false;
      if (isCached) {
        Alert.alert(
          'Network Error',
          'Could not submit registration to server. Save registration locally instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Save Offline',
              onPress: async () => {
                const offlineId = await OfflineManager.queueRegistration(selectedCampaign?.id!, cleanData);
                setIsOfflineMode(true);
                setSubmitReceipt({
                  registrationId: offlineId,
                  thankYouMessage: 'Saved offline! Data will sync once connection is restored.',
                });
                setCurrentScreen('SUCCESS');
                updateUnsyncedCounts();
              }
            }
          ]
        );
      } else {
        Alert.alert('Submission Failed', err.message || 'Error occurred while saving registration.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.rootSafeArea} edges={['top']}>
      {isOfflineMode && (
        <View style={{ backgroundColor: '#b45309', paddingVertical: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
            ⚠️ RUNNING IN OFFLINE MODE (DATA SAVED LOCALLY)
          </Text>
        </View>
      )}
      {currentScreen === 'CONFIG_LOGIN' && (
        <ConfigLoginScreen
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          apiKey={apiKey}
          setApiKey={setApiKey}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={loading}
          showConfig={showConfig}
          setShowConfig={setShowConfig}
          handleSaveConfig={handleSaveConfig}
          handleLogin={handleLogin}
        />
      )}

      {currentScreen === 'DASHBOARD' && (
        <DashboardScreen
          serverUrl={serverUrl}
          token={token}
          handleLogout={handleLogout}
          onNavigate={(s) => setCurrentScreen(s as any)}
          onSelectCampaign={handleSelectCampaign}
          onOpenMenu={() => setIsDrawerOpen(true)}
          user={user}
        />
      )}
      
      {currentScreen === 'CAMPAIGNS' && (
        <CampaignsScreen
          campaigns={campaigns}
          user={user}
          searchVal={searchVal}
          setSearchVal={setSearchVal}
          loading={loading}
          loadingText={loadingText}
          handleLogout={handleLogout}
          loadCampaigns={loadCampaigns}
          handleSelectCampaign={handleSelectCampaign}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onNavigate={(s) => setCurrentScreen(s as any)}
          setCampaignIdToEdit={setCampaignIdToEdit}
          serverUrl={serverUrl}
          token={token}
          isOfflineMode={isOfflineMode}
        />
      )}

      {currentScreen === 'CREATE_CAMPAIGN' && (
        <CreateCampaignScreen
          serverUrl={serverUrl}
          token={token}
          campaignIdToEdit={campaignIdToEdit}
          onClose={() => {
            setCampaignIdToEdit(null);
            setCurrentScreen('DASHBOARD');
          }}
          onOpenMenu={() => setIsDrawerOpen(true)}
        />
      )}

      {currentScreen === 'ALL_ENTRIES' && (
        <AllEntriesScreen
          serverUrl={serverUrl}
          token={token}
          onClose={() => setCurrentScreen('DASHBOARD')}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenTestForm={(regId, campId) => {
            setActiveTestRegId(regId);
            const camp = campaigns.find(c => String(c.id) === String(campId));
            if (camp) setSelectedCampaign(camp);
            setTestReturnScreen('ALL_ENTRIES');
            setCurrentScreen('DIAGNOSTIC_TEST');
          }}
          onOpenRegisterForm={(campId) => {
            const camp = campaigns.find(c => String(c.id) === String(campId));
            if (camp) {
              setSelectedCampaign(camp);
              handleStartRegistration(camp);
            }
          }}
        />
      )}

      {currentScreen === 'REGISTERED_PATIENTS' && (
        <RegisteredPatientsScreen
          serverUrl={serverUrl}
          token={token}
          onClose={() => setCurrentScreen('DASHBOARD')}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onOpenTestForm={(regId, camp) => {
            setActiveTestRegId(regId);
            setSelectedCampaign(camp);
            setTestReturnScreen('REGISTERED_PATIENTS');
            setCurrentScreen('DIAGNOSTIC_TEST');
          }}
          isOfflineMode={isOfflineMode}
          updateUnsyncedCounts={updateUnsyncedCounts}
        />
      )}

      {currentScreen === 'SETTINGS' && (
        <SettingsScreen
          serverUrl={serverUrl}
          token={token}
          onOpenMenu={() => setIsDrawerOpen(true)}
        />
      )}

      {currentScreen === 'REPORTS' && (
        <ReportsScreen
          serverUrl={serverUrl}
          token={token}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onSelectCampaign={(id) => {
            const camp = campaigns.find(c => String(c.id) === String(id));
            if (camp) {
              setSelectedCampaign(camp);
              setCurrentScreen('CAMPAIGN_DETAILS');
            }
          }}
        />
      )}
      
      {currentScreen === 'CAMPAIGN_DETAILS' && selectedCampaign && (
        <CampaignDetailsScreen
          campaignId={selectedCampaign.id}
          serverUrl={serverUrl}
          token={token}
          onClose={() => setCurrentScreen('CAMPAIGNS')}
          onNavigate={(s) => setCurrentScreen(s as any)}
          setCampaignIdToEdit={setCampaignIdToEdit}
          onSelectCampaign={handleStartRegistration}
          user={user}
          isOfflineMode={isOfflineMode}
        />
      )}

      {currentScreen === 'FORM' && selectedCampaign && (
        <RegistrationFormScreen
          selectedCampaign={selectedCampaign}
          fields={fields}
          formValues={formValues}
          setFormValues={setFormValues}
          validationErrors={validationErrors}
          uploadingField={uploadingField}
          submitting={submitting}
          handleSubmitForm={handleSubmitForm}
          setCurrentScreen={setCurrentScreen}
          handleSelectFile={handleSelectFile}
          removeUploadedFile={removeUploadedFile}
          handleChoiceChange={handleChoiceChange}
          setActiveAadharField={setActiveAadharField}
          setFrontImageUri={setFrontImageUri}
          setBackImageUri={setBackImageUri}
          setIsAadharModalOpen={setIsAadharModalOpen}
          setActiveSignatureField={setActiveSignatureField}
          setSignaturePaths={setSignaturePaths}
          setIsSignatureModalOpen={setIsSignatureModalOpen}
          triggerAadharExtraction={triggerAadharExtraction}
          ocrLoading={ocrLoading}
        />
      )}
      
      {currentScreen === 'SUCCESS' && (
        <SuccessReceiptScreen
          selectedCampaign={selectedCampaign}
          submitReceipt={submitReceipt}
          setSubmitReceipt={setSubmitReceipt}
          setCurrentScreen={setCurrentScreen}
          onOpenTestForm={(regId) => {
            setActiveTestRegId(regId);
            setTestReturnScreen('FORM');
            setCurrentScreen('DIAGNOSTIC_TEST');
          }}
        />
      )}

      {currentScreen === 'TEST_TEMPLATES' && (
        <TestTemplatesScreen
          serverUrl={serverUrl}
          token={token}
          onClose={() => setCurrentScreen('DASHBOARD')}
          onOpenMenu={() => setIsDrawerOpen(true)}
        />
      )}

      {currentScreen === 'DIAGNOSTIC_TEST' && selectedCampaign && (
        <DiagnosticTestFormScreen
          serverUrl={serverUrl}
          token={token}
          registrationId={activeTestRegId}
          campaign={selectedCampaign}
          onSaveSuccess={() => {
            setCurrentScreen('REFERRAL_TRAVEL');
          }}
          onClose={() => {
            if (testReturnScreen === 'FORM') {
              setCurrentScreen('CAMPAIGNS');
            } else {
              setCurrentScreen(testReturnScreen);
            }
          }}
          isOfflineMode={isOfflineMode}
          updateUnsyncedCounts={updateUnsyncedCounts}
        />
      )}

      {currentScreen === 'REFERRAL_TRAVEL' && (
        <ReferralTravelScreen
          serverUrl={serverUrl}
          token={token}
          registrationId={activeTestRegId}
          onFinish={() => {
            if (testReturnScreen === 'FORM' && selectedCampaign) {
              handleStartRegistration(selectedCampaign);
            } else {
              setCurrentScreen(testReturnScreen);
            }
          }}
          isOfflineMode={isOfflineMode}
          updateUnsyncedCounts={updateUnsyncedCounts}
        />
      )}

      {/* Navigation Drawer Overlay */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentScreen={currentScreen}
        onNavigate={(screen: any) => {
          if (screen === 'CREATE_CAMPAIGN') {
            setCampaignIdToEdit(null);
          }
          setCurrentScreen(screen);
        }}
        user={user}
        handleLogout={handleLogout}
        unsyncedCount={unsyncedCount}
        isOfflineMode={isOfflineMode}
        onSync={handleSyncOfflineData}
      />

      {/* Aadhaar Card Scanner Modal overlay */}
      <AadharScannerModal
        visible={isAadharModalOpen}
        onClose={() => setIsAadharModalOpen(false)}
        frontImageUri={frontImageUri}
        setFrontImageUri={setFrontImageUri}
        backImageUri={backImageUri}
        setBackImageUri={setBackImageUri}
        ocrLoading={ocrLoading}
        ocrMessage={ocrMessage}
        handleCaptureOcrSide={handleCaptureOcrSide}
        handleTriggerOcrExtraction={handleTriggerOcrExtraction}
      />

      {/* Signature Pad Modal overlay */}
      <SignaturePadModal
        visible={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        signaturePaths={signaturePaths}
        currentSignaturePath={currentSignaturePath}
        ocrLoading={ocrLoading}
        ocrMessage={ocrMessage}
        handleSignatureTouchStart={handleSignatureTouchStart}
        handleSignatureTouchMove={handleSignatureTouchMove}
        handleSignatureTouchEnd={handleSignatureTouchEnd}
        handleClearSignature={handleClearSignature}
        handleSaveSignature={handleSaveSignature}
      />
    </SafeAreaView>
  );
}
