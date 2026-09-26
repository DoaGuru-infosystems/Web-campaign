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
  BookOpen,
  Camera,
  Sparkles,
  UserPlus,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import api from '../utils/api';

const compressImage = (file) => {
  return new Promise((resolve) => {
    // If not an image, return original
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // fallback to original if blob creation fails
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const detectBlur = (canvas) => {
  const width = canvas.width;
  const height = canvas.height;
  
  // Downscale image to a reasonable size (e.g. max 300px width/height) to speed up blur calculation
  const maxDim = 300;
  let w = width;
  let h = height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0, w, h);
  
  try {
    const imageData = tempCtx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    
    // Convert to grayscale
    const gray = new Float32Array(w * h);
    for (let i = 0; i < pixels.length; i += 4) {
      gray[i / 4] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    }
    
    // Apply Laplacian kernel:
    // [ 0,  1,  0 ]
    // [ 1, -4,  1 ]
    // [ 0,  1,  0 ]
    const laplacian = new Float32Array(w * h);
    let sum = 0;
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const val = 
          gray[idx - w] + // top
          gray[idx - 1] + // left
          -4 * gray[idx] + // center
          gray[idx + 1] + // right
          gray[idx + w];  // bottom
        laplacian[idx] = val;
        sum += val;
      }
    }
    
    const mean = sum / (w * h);
    
    // Compute variance
    let varianceSum = 0;
    for (let i = 0; i < laplacian.length; i++) {
      const diff = laplacian[i] - mean;
      varianceSum += diff * diff;
    }
    
    const variance = varianceSum / (w * h);
    return variance;
  } catch (e) {
    console.error('Blur detection failed, bypassing:', e);
    return 100; // Return safe variance if getImageData fails
  }
};

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

  // Dropdown for previous participants
  const [previousParticipants, setPreviousParticipants] = useState([]);
  const [participantSearchText, setParticipantSearchText] = useState('');
  const [isParticipantDropdownOpen, setIsParticipantDropdownOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsParticipantDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // OCR state for Aadhaar card parsing
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');

  // Signature Pad State
  const sigCanvasRefs = useRef({});
  const isDrawingRefs = useRef({});

  // Check if field is Aadhaar Card
  const isFieldAadhar = (fieldName) => {
    if (!fieldName) return false;
    const targetField = fields.find(f => f.field_name === fieldName);
    const labelLower = (targetField?.label || '').toLowerCase();
    const fieldNameLower = fieldName.toLowerCase();
    const fieldTypeLower = (targetField?.field_type || '').toLowerCase();
    return (
      labelLower.includes('aadhar') || 
      labelLower.includes('aadhaar') || 
      fieldNameLower.includes('aadhar') || 
      fieldNameLower.includes('aadhaar') ||
      fieldTypeLower.includes('aadhar') ||
      fieldTypeLower.includes('aadhaar')
    );
  };

  // Camera Modal States & Handlers
  const [activeCameraField, setActiveCameraField] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraWarning, setCameraWarning] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'user' or 'environment'
  const videoRef = useRef(null);

  // Aadhaar 2-Step Camera States: 'front' | 'front_preview' | 'back' | 'both_preview'
  const [aadharCaptureStep, setAadharCaptureStep] = useState('front');
  const [aadharFront, setAadharFront] = useState({ blob: null, previewUrl: '', warning: '', isExisting: false });
  const [aadharBack, setAadharBack] = useState({ blob: null, previewUrl: '', warning: '' });

  const openCamera = (fieldName) => {
    const isAadhar = isFieldAadhar(fieldName);
    if (isAadhar) {
      const existingVals = Array.isArray(formValues[fieldName]) 
        ? formValues[fieldName] 
        : (formValues[fieldName] ? [formValues[fieldName]] : []);
      
      if (existingVals.length === 1) {
        // Front already uploaded, open directly to capture Back side
        setAadharCaptureStep('back');
        setAadharFront({ 
          blob: null, 
          previewUrl: existingVals[0].url ? `${api.BACKEND_URL}${existingVals[0].url}` : '', 
          warning: '', 
          isExisting: true 
        });
        setAadharBack({ blob: null, previewUrl: '', warning: '' });
      } else {
        // Fresh 2-step capture
        setAadharCaptureStep('front');
        setAadharFront({ blob: null, previewUrl: '', warning: '', isExisting: false });
        setAadharBack({ blob: null, previewUrl: '', warning: '' });
      }
    }
    setActiveCameraField(fieldName);
  };

  const closeCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    if (aadharFront.previewUrl && aadharFront.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(aadharFront.previewUrl);
    }
    if (aadharBack.previewUrl && aadharBack.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(aadharBack.previewUrl);
    }
    setCapturedImage(null);
    setCapturedBlob(null);
    setAadharFront({ blob: null, previewUrl: '', warning: '', isExisting: false });
    setAadharBack({ blob: null, previewUrl: '', warning: '' });
    setAadharCaptureStep('front');
    setCameraError('');
    setCameraWarning('');
    setActiveCameraField(null);
  };

  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError('');
    setCameraWarning('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported on this browser or connection. Please use a secure (HTTPS) connection or upload a file instead.');
      setCameraLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 4032 },
          height: { ideal: 3024 }
        }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera 4K constraints failed, falling back to 1080p:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        setCameraStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        console.error('All camera resolutions failed:', fallbackErr);
        setCameraError('Could not access camera. Please make sure permissions are granted.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    if (activeCameraField) {
      startCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      if (capturedImage && capturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(capturedImage);
      }
      setCapturedImage(null);
      setCapturedBlob(null);
      setCameraError('');
      setCameraWarning('');
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeCameraField, facingMode]);

  // Ensure stream binds when video element mounts
  useEffect(() => {
    if (videoRef.current && cameraStream && !capturedImage) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, capturedImage, aadharCaptureStep]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    let w = video.videoWidth || 1280;
    let h = video.videoHeight || 720;
    const maxDim = 1600;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    // High-quality rendering settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, w, h);

    // Stop camera stream while reviewing
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        
        // Run blur detection
        const variance = detectBlur(canvas);
        const warning = variance < 80 
          ? 'The photo appears slightly blurry. For optimal OCR accuracy, hold steady and ensure good lighting.' 
          : '';

        const isAadhar = isFieldAadhar(activeCameraField);

        if (!isAadhar) {
          setCapturedImage(blobUrl);
          setCapturedBlob(blob);
          setCameraWarning(warning);
        } else {
          if (aadharCaptureStep === 'front') {
            setAadharFront({ blob, previewUrl: blobUrl, warning, isExisting: false });
            setAadharCaptureStep('front_preview');
            setCameraWarning(warning);
          } else if (aadharCaptureStep === 'back') {
            setAadharBack({ blob, previewUrl: blobUrl, warning });
            setAadharCaptureStep('both_preview');
            setCameraWarning(warning);
          }
        }
      },
      'image/jpeg',
      0.85
    );
  };

  const handleRetakeFront = () => {
    if (aadharFront.previewUrl && aadharFront.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(aadharFront.previewUrl);
    }
    setAadharFront({ blob: null, previewUrl: '', warning: '', isExisting: false });
    setAadharCaptureStep('front');
    setCameraWarning('');
    startCamera();
  };

  const handleProceedToBack = () => {
    setAadharCaptureStep('back');
    setCameraWarning('');
    startCamera();
  };

  const handleRetakeBack = () => {
    if (aadharBack.previewUrl && aadharBack.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(aadharBack.previewUrl);
    }
    setAadharBack({ blob: null, previewUrl: '', warning: '' });
    setAadharCaptureStep('back');
    setCameraWarning('');
    startCamera();
  };

  const handleRetry = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedBlob(null);
    setCapturedImage(null);
    setCameraWarning('');
    startCamera();
  };
  const triggerAadharExtraction = async (filesOrFilename, originalname = '') => {
    setOcrLoading(true);
    setOcrMessage('Reading Aadhaar card... Extracting name, DOB, gender, address, city, district, and Aadhar number.');
    try {
      let payload = {};
      if (Array.isArray(filesOrFilename)) {
        payload = { files: filesOrFilename };
      } else {
        payload = { filename: filesOrFilename, originalname };
      }

      const response = await api.post('/upload/extract-aadhar', payload);
      const details = response.data || response;

      // Check if we actually extracted any values
      const extractedKeys = ['aadharNumber', 'name', 'dob', 'gender', 'address', 'city', 'district', 'state', 'pincode'];
      const hasData = details && extractedKeys.some(k => details[k] && String(details[k]).trim() !== '');

      if (!hasData) {
        if (response && response.message && (response.message.includes('PDF') || response.message.includes('not supported'))) {
          setOcrMessage(response.message);
        } else {
          setOcrMessage('Could not extract details from the document. Please ensure the image is clear and readable, or fill the fields manually.');
        }
        return;
      }

      // Autofill matching fields
      setFormValues(prev => {
        const updated = { ...prev };
        
        fields.forEach(f => {
          const fLabelLower = (f.label || '').trim().toLowerCase();
          const fNameLower = (f.field_name || '').trim().toLowerCase();
          const fTypeLower = (f.field_type || '').trim().toLowerCase();
          
          // CRITICAL: Never overwrite photo, image, file upload or signature fields with text strings!
          const isFileField = 
            fTypeLower.includes('photo') || 
            fTypeLower.includes('upload') || 
            fTypeLower.includes('file') || 
            fTypeLower.includes('image') || 
            fTypeLower.includes('signature');
          if (isFileField) return;

          // 1. Aadhaar Number (only for text/number fields)
          const isAadharNumField = 
            fTypeLower.includes('aadhar') || 
            fTypeLower.includes('aadhaar') || 
            fLabelLower.includes('aadhar number') || 
            fLabelLower.includes('aadhaar number') || 
            fLabelLower.includes('uid') ||
            fNameLower.includes('aadharnumber') || 
            fNameLower.includes('aadhar_number') ||
            ((fLabelLower.includes('aadhar') || fLabelLower.includes('aadhaar')) && !fLabelLower.includes('card') && !fLabelLower.includes('photo') && !fLabelLower.includes('upload'));

          if (isAadharNumField) {
            if (details.aadharNumber) {
              updated[f.field_name] = details.aadharNumber;
            }
          }
          // 2. Full Name (guarding against relative/other names)
          else if (
            (fLabelLower.includes('name') || fNameLower.includes('name')) &&
            !fLabelLower.includes('father') &&
            !fLabelLower.includes('mother') &&
            !fLabelLower.includes('spouse') &&
            !fLabelLower.includes('husband') &&
            !fLabelLower.includes('wife') &&
            !fLabelLower.includes('doctor') &&
            !fLabelLower.includes('guardian') &&
            !fLabelLower.includes('nominee') &&
            !fLabelLower.includes('witness') &&
            !fLabelLower.includes('campaign')
          ) {
            if (details.name) {
              updated[f.field_name] = details.name;
            }
          }
          // 3. Date of Birth
          else if (fLabelLower.includes('dob') || fLabelLower.includes('birth') || fLabelLower.includes('date of birth') || fNameLower.includes('dob') || fNameLower.includes('birth')) {
            if (details.dob) {
              // Convert DOB to YYYY-MM-DD if target field type is Date or Date Field
              if (['Date', 'Date Field'].includes(f.field_type) && details.dob.includes('/')) {
                const parts = details.dob.split('/');
                if (parts.length === 3) {
                  const day = parts[0].padStart(2, '0');
                  const month = parts[1].padStart(2, '0');
                  const year = parts[2];
                  updated[f.field_name] = `${year}-${month}-${day}`; // YYYY-MM-DD
                } else {
                  updated[f.field_name] = details.dob;
                }
              } else {
                updated[f.field_name] = details.dob;
              }
            }
          }
          // 4. Gender
          else if (fLabelLower.includes('gender') || fLabelLower.includes('sex') || fNameLower.includes('gender') || fNameLower.includes('sex') || fTypeLower === 'gender') {
            if (details.gender) {
              const gLower = details.gender.toLowerCase();
              if (gLower.includes('f') || gLower.includes('महिला') || gLower.includes('female')) {
                updated[f.field_name] = 'Female';
              } else if (gLower.includes('m') || gLower.includes('पुरुष') || gLower.includes('male')) {
                updated[f.field_name] = 'Male';
              } else {
                updated[f.field_name] = details.gender;
              }
            }
          }
          // 5. Address
          else if (fLabelLower.includes('address') || fNameLower.includes('address')) {
            const addrVal = details.fullAddress || details.address;
            if (addrVal) {
              updated[f.field_name] = addrVal;
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
          else if (fLabelLower.includes('pincode') || fLabelLower.includes('pin code') || fNameLower.includes('pincode') || fNameLower.includes('pin')) {
            if (details.pincode) {
              updated[f.field_name] = details.pincode;
            }
          }
        });
        
        return updated;
      });
      setOcrMessage(response.message || 'Aadhaar card details extracted and filled successfully!');
    } catch (err) {
      console.error('Aadhaar OCR extraction error:', err);
      setOcrMessage('Failed to extract details from Aadhaar card. Please fill the fields manually.');
    } finally {
      setOcrLoading(false);
      setTimeout(() => setOcrMessage(''), 8000);
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedBlob || !activeCameraField) return;
    
    const fieldName = activeCameraField;
    closeCameraModal();
    
    setUploadingField(prev => ({ ...prev, [fieldName]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));
    
    try {
      const file = new File([capturedBlob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      const res = await api.upload(file, (percent) => {
        setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
      });
      
      const isAadharUpload = isFieldAadhar(fieldName);

      let allAadharFiles = [];
      setFormValues(prev => {
        if (isAadharUpload) {
          const existing = Array.isArray(prev[fieldName]) ? prev[fieldName] : (prev[fieldName] ? [prev[fieldName]] : []);
          allAadharFiles = [...existing, res];
          return { ...prev, [fieldName]: allAadharFiles };
        }
        return { ...prev, [fieldName]: res };
      });

      if (isAadharUpload && res.filename) {
        triggerAadharExtraction(allAadharFiles.length > 1 ? allAadharFiles : res.filename, res.originalname);
      }
    } catch (err) {
      alert(err.message || 'Photo upload failed.');
    } finally {
      setUploadingField(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleUseBothAadharPhotos = async (frontOnly = false) => {
    if (!activeCameraField) return;
    const fieldName = activeCameraField;
    const frontBlob = aadharFront.blob;
    const backBlob = aadharBack.blob;

    if (!frontBlob && !aadharFront.isExisting) return;

    closeCameraModal();

    setUploadingField(prev => ({ ...prev, [fieldName]: true }));
    setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));

    try {
      const uploadedFiles = [];

      // 1. Upload Front side (if newly captured)
      if (frontBlob) {
        const frontFile = new File([frontBlob], `aadhar_front_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const frontRes = await api.upload(frontFile, (percent) => {
          setUploadProgress(prev => ({ 
            ...prev, 
            [fieldName]: backBlob && !frontOnly ? Math.round(percent / 2) : percent 
          }));
        });
        uploadedFiles.push(frontRes);
      }

      // 2. Upload Back side (if captured and not frontOnly)
      if (backBlob && !frontOnly) {
        const backFile = new File([backBlob], `aadhar_back_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const backRes = await api.upload(backFile, (percent) => {
          setUploadProgress(prev => ({ 
            ...prev, 
            [fieldName]: 50 + Math.round(percent / 2) 
          }));
        });
        uploadedFiles.push(backRes);
      }

      let allFiles = [];
      setFormValues(prev => {
        const existing = Array.isArray(prev[fieldName]) ? prev[fieldName] : (prev[fieldName] ? [prev[fieldName]] : []);
        if (aadharFront.isExisting) {
          allFiles = [...existing, ...uploadedFiles];
        } else {
          allFiles = uploadedFiles;
        }
        return { ...prev, [fieldName]: allFiles };
      });

      // 3. Trigger unified extraction with BOTH files in a SINGLE call!
      if (allFiles.length > 0) {
        await triggerAadharExtraction(allFiles);
      } else if (uploadedFiles.length > 0) {
        await triggerAadharExtraction(uploadedFiles);
      }
    } catch (err) {
      alert(err.message || 'Failed to upload Aadhaar photos.');
    } finally {
      setUploadingField(prev => ({ ...prev, [fieldName]: false }));
    }
  };
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
        
        // Sort Aadhaar fields to the top
        const sortedFields = [...data.fields].sort((a, b) => {
          const aLower = (a.label || '').toLowerCase();
          const bLower = (b.label || '').toLowerCase();
          const aIsAadhar = aLower.includes('aadhar') || aLower.includes('aadhaar') || a.field_type === 'Aadhaar Number';
          const bIsAadhar = bLower.includes('aadhar') || bLower.includes('aadhaar') || b.field_type === 'Aadhaar Number';
          if (aIsAadhar && !bIsAadhar) return -1;
          if (!aIsAadhar && bIsAadhar) return 1;
          return 0;
        });
        setFields(sortedFields);
        
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

  // Fetch participants when campaign id or submitSuccess state changes
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!api.getToken()) return;
      try {
        const data = await api.get(`/registrations/campaign/${id}?limit=1000`);
        setPreviousParticipants(data.registrations || []);
      } catch (err) {
        console.error('Could not fetch participants for dropdown', err);
      }
    };
    fetchParticipants();
  }, [id, submitSuccess]);

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

    const targetField = fields.find(f => f.field_name === fieldName);
    const labelLower = (targetField?.label || '').toLowerCase();
    const fieldNameLower = fieldName.toLowerCase();
    const fieldTypeLower = (targetField?.field_type || '').toLowerCase();

    const isAadharUpload = 
      labelLower.includes('aadhar') || 
      labelLower.includes('aadhaar') || 
      fieldNameLower.includes('aadhar') || 
      fieldNameLower.includes('aadhaar') ||
      fieldTypeLower.includes('aadhar') ||
      fieldTypeLower.includes('aadhaar');

    try {
      if (isMultiple) {
        const uploadedArr = Array.isArray(formValues[fieldName]) ? [...formValues[fieldName]] : [];
        for (let file of filesList) {
          const fileToUpload = await compressImage(file);
          const res = await api.upload(fileToUpload, (percent) => {
            setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
          });
          uploadedArr.push(res);
        }
        setFormValues(prev => ({ ...prev, [fieldName]: uploadedArr }));
        if (isAadharUpload && uploadedArr.length > 0) {
          triggerAadharExtraction(uploadedArr);
        }
      } else {
        const file = filesList[0];
        const fileToUpload = await compressImage(file);
        const res = await api.upload(fileToUpload, (percent) => {
          setUploadProgress(prev => ({ ...prev, [fieldName]: percent }));
        });
        
        let allAadharFiles = [];
        setFormValues(prev => {
          if (isAadharUpload) {
            const existing = Array.isArray(prev[fieldName]) ? prev[fieldName] : (prev[fieldName] ? [prev[fieldName]] : []);
            allAadharFiles = [...existing, res];
            return { ...prev, [fieldName]: allAadharFiles };
          }
          return { ...prev, [fieldName]: res };
        });

        if (isAadharUpload && res.filename) {
          triggerAadharExtraction(allAadharFiles.length > 1 ? allAadharFiles : res.filename, res.originalname);
        }
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

  // Multi choice change (handles checkbox / multi-select including "Other" option)
  const handleChoiceChange = (fieldName, val, isChecked, isMultiple = false) => {
    if (isMultiple) {
      const current = Array.isArray(formValues[fieldName]) ? [...formValues[fieldName]] : [];
      if (isChecked) {
        if (!current.includes(val)) current.push(val);
      } else {
        const index = current.indexOf(val);
        if (index > -1) current.splice(index, 1);
        // Clear the "Other" text when Other is unchecked
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
      // Validate that "Other" text is filled when ticked
      if (Array.isArray(val) && val.includes('Other')) {
        const otherText = (formValues[`__other_${f.field_name}`] || '').trim();
        if (!otherText) {
          errors[f.field_name] = `Please specify the "Other" value for "${f.label}".`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSubmitLoading(false);
      window.scrollTo(0, 0);
      return;
    }

    // Build clean submitted_data: replace "Other" in arrays with typed text,
    // and strip __other_ helper keys from the payload
    const cleanData = {};
    Object.entries(formValues).forEach(([key, val]) => {
      if (key.startsWith('__other_')) return; // skip helper keys
      if (Array.isArray(val) && val.includes('Other')) {
        const otherText = (formValues[`__other_${key}`] || '').trim();
        cleanData[key] = val.map(v => (v === 'Other' ? otherText : v));
      } else {
        cleanData[key] = val;
      }
    });

    try {
      let res;
      if (selectedPatientId) {
        res = await api.put(`/registrations/${selectedPatientId}`, {
          submitted_data: cleanData
        });
      } else {
        res = await api.post('/registrations', {
          campaign_id: id,
          submitted_data: cleanData
        });
      }

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

          <div className="flex flex-col space-y-3 w-full border-t border-slate-100 pt-5 print:hidden">
            <button
              onClick={() => {
                setFormValues({});
                setValidationErrors({});
                setSubmitSuccess(false);
                setGeneratedRegId('');
                setParticipantSearchText('');
                setSelectedPatientId(null);
                window.scrollTo(0, 0);
              }}
              className="w-full flex items-center justify-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-3 rounded-xl transition shadow-lg shadow-violet-600/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>Register New Patient</span>
            </button>
            <button
              onClick={() => navigate(`/campaign/details/${id}`)}
              className="w-full flex items-center justify-center space-x-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-3 rounded-xl transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Campaign Details</span>
            </button>
            <div className="flex items-center space-x-3 w-full">
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
      </div>
    );
  }

  const processedParticipants = previousParticipants.map(p => {
    let nameStr = null;
    if (p.submitted_data && typeof p.submitted_data === 'object') {
      const nameField = fields.find(f => (f.label || '').toLowerCase().includes('name'));
      if (nameField && p.submitted_data[nameField.field_name]) {
        nameStr = p.submitted_data[nameField.field_name];
      }
      if (!nameStr) {
        const keyMatch = Object.keys(p.submitted_data).find(key => key.toLowerCase().includes('name'));
        if (keyMatch) nameStr = p.submitted_data[keyMatch];
      }
    }
    nameStr = nameStr || p.registration_id;
    return { 
      ...p, 
      rawName: nameStr,
      displayName: `${nameStr} - ${p.registration_id} (${new Date(p.created_at).toLocaleDateString()})`, 
      searchString: `${nameStr} ${p.registration_id}`.toLowerCase() 
    };
  });

  const filteredParticipants = processedParticipants.filter(p => p.searchString.includes(participantSearchText.toLowerCase()));

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

          {/* Previous Participants Dropdown */}
          {previousParticipants.length > 0 && (
            <div className="bg-white/40 border border-white/30 p-4 rounded-2xl mb-4 relative" ref={dropdownRef}>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Autofill from Previous Patient
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search name or ID to autofill..."
                  value={participantSearchText}
                  onChange={(e) => {
                    setParticipantSearchText(e.target.value);
                    setIsParticipantDropdownOpen(true);
                  }}
                  onFocus={() => setIsParticipantDropdownOpen(true)}
                  className="w-full bg-white border border-slate-200 text-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-sm"
                />
                {participantSearchText && (
                  <button 
                    onClick={() => {
                      setParticipantSearchText('');
                      setIsParticipantDropdownOpen(false);
                      setSelectedPatientId(null);
                      // Reset form values if they clear it
                      const defaults = {};
                      fields.forEach(f => {
                        if (f.field_type === 'Checkbox' || f.field_type === 'Multi Select') {
                          defaults[f.field_name] = [];
                        } else {
                          defaults[f.field_name] = '';
                        }
                      });
                      setFormValues(defaults);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {isParticipantDropdownOpen && (
                <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto left-0 origin-top animate-in fade-in zoom-in-95 duration-200">
                  {filteredParticipants.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">No patients found.</div>
                  ) : (
                    filteredParticipants.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 focus:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors outline-none"
                        onClick={() => {
                          setParticipantSearchText(p.displayName);
                          setIsParticipantDropdownOpen(false);
                          setSelectedPatientId(p.id);
                          
                          if (p.submitted_data) {
                            setFormValues(prev => ({
                              ...prev,
                              ...p.submitted_data
                            }));
                          }
                        }}
                      >
                        <div className="text-xs font-bold text-slate-700">{p.rawName || p.registration_id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{p.registration_id} • {new Date(p.created_at).toLocaleDateString()}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form validation alert */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs rounded-2xl flex items-center font-semibold">
              <AlertCircle className="h-5 w-5 mr-3 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* OCR Processing Message */}
          {ocrMessage && (
            <div className={`p-4 border rounded-2xl flex items-center text-xs font-semibold ${
              ocrMessage.includes('failed') || ocrMessage.includes('Failed')
                ? 'bg-rose-500/10 border-rose-500/35 text-rose-300'
                : ocrMessage.includes('successfully')
                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-600'
                  : 'bg-indigo-500/10 border-indigo-500/35 text-indigo-650'
            }`}>
              {ocrLoading ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3 shrink-0" />
              ) : ocrMessage.includes('successfully') ? (
                <Sparkles className="h-4 w-4 mr-3 text-emerald-500 shrink-0 animate-bounce" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-3 text-rose-500 shrink-0" />
              )}
              <span>{ocrMessage}</span>
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
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap gap-4">
                        {f.options?.map((opt, oi) => (
                          <label key={oi} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={Array.isArray(value) && value.includes(opt)}
                              onChange={(e) => handleChoiceChange(f.field_name, opt, e.target.checked, true)}
                              className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            <span className="group-hover:text-violet-700 transition">{opt}</span>
                          </label>
                        ))}
                      </div>
                      {/* "Other" free-text input — revealed only when Other is ticked */}
                      {Array.isArray(value) && value.includes('Other') && (
                        <div className="flex items-center gap-2 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="w-0.5 h-8 bg-violet-300 rounded-full shrink-0" />
                          <input
                            type="text"
                            value={formValues[`__other_${f.field_name}`] || ''}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [`__other_${f.field_name}`]: e.target.value }))}
                            placeholder="Please specify..."
                            className="flex-1 text-xs px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-slate-800 placeholder-violet-300 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 10. Multi Select */}
                  {f.field_type === 'Multi Select' && (
                    <div className="space-y-3">
                      <div className="border border-white/30 rounded-xl p-3.5 space-y-2.5 bg-white/40 max-h-40 overflow-y-auto">
                        {f.options?.map((opt, oi) => (
                          <label key={oi} className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={Array.isArray(value) && value.includes(opt)}
                              onChange={(e) => handleChoiceChange(f.field_name, opt, e.target.checked, true)}
                              className="rounded text-violet-600 focus:ring-violet-500"
                            />
                            <span className="group-hover:text-violet-700 transition">{opt}</span>
                          </label>
                        ))}
                      </div>
                      {/* "Other" free-text input for Multi Select */}
                      {Array.isArray(value) && value.includes('Other') && (
                        <div className="flex items-center gap-2 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="w-0.5 h-8 bg-violet-300 rounded-full shrink-0" />
                          <input
                            type="text"
                            value={formValues[`__other_${f.field_name}`] || ''}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [`__other_${f.field_name}`]: e.target.value }))}
                            placeholder="Please specify..."
                            className="flex-1 text-xs px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-slate-800 placeholder-violet-300 focus:outline-none focus:border-violet-500 focus:bg-white transition"
                          />
                        </div>
                      )}
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
                  {['Single Image Upload', 'Single PDF Upload', 'File Upload', 'Click Photo'].includes(f.field_type) && (
                    (() => {
                      const labelLower = (f.label || '').toLowerCase();
                      const fieldNameLower = (f.field_name || '').toLowerCase();
                      const fieldTypeLower = (f.field_type || '').toLowerCase();
                      const isAadharField = labelLower.includes('aadhar') || labelLower.includes('aadhaar') || fieldNameLower.includes('aadhar') || fieldNameLower.includes('aadhaar') || fieldTypeLower.includes('aadhar') || fieldTypeLower.includes('aadhaar');
                      
                      const vals = Array.isArray(value) ? value : (value ? [value] : []);

                      return (
                        <div className="space-y-2">
                          {vals.length > 0 && (
                            <div className="space-y-2">
                              {vals.map((v, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-violet-50/40 border border-violet-100 p-3 rounded-xl">
                                  <div className="flex items-center space-x-2">
                                    <FileText className="h-5 w-5 text-violet-500" />
                                    <div className="text-left">
                                      <span className="block text-[11px] font-bold text-slate-700 truncate max-w-[180px]">
                                        {isAadharField ? `Aadhaar Side ${idx + 1} (${v.originalname})` : v.originalname}
                                      </span>
                                      <span className="block text-[9px] text-slate-400">{(v.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isAadharField) {
                                        const newVals = vals.filter((_, i) => i !== idx);
                                        setFormValues(prev => ({ ...prev, [f.field_name]: newVals.length > 0 ? newVals : '' }));
                                      } else {
                                        removeUploadedFile(f.field_name, v.url, false);
                                      }
                                    }}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {(!value || (isAadharField && vals.length < 2)) && (
                            <div>
                              {isUploading ? (
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 py-6 rounded-2xl bg-slate-50">
                                  <Loader2 className="h-6 w-6 text-violet-600 animate-spin mx-auto mb-2" />
                                  <span className="text-[10px] text-slate-500 font-semibold">Uploading: {progress}%</span>
                                </div>
                              ) : (
                                f.field_type === 'Click Photo' ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Option 1: Camera */}
                                    <button
                                      type="button"
                                      onClick={() => openCamera(f.field_name)}
                                      className="flex flex-col items-center justify-center border-2 border-dashed border-violet-200 hover:border-violet-500 hover:bg-violet-500/5 py-6 rounded-2xl cursor-pointer transition text-center"
                                    >
                                      <Camera className="h-6 w-6 text-violet-500 mb-1.5" />
                                      <span className="block text-xs font-bold text-violet-600">
                                        {isAadharField && vals.length === 1 ? 'Capture Back Side' : (isAadharField ? 'Scan Aadhaar (Front & Back)' : 'Take Photo (Camera)')}
                                      </span>
                                      <span className="block text-[9px] text-slate-400 mt-0.5">
                                        {isAadharField ? '2-step capture: Front & Back together' : 'Directly capture using camera'}
                                      </span>
                                    </button>
                                    
                                    {/* Option 2: Upload File */}
                                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-violet-500 hover:bg-violet-500/5 py-6 rounded-2xl cursor-pointer transition text-center">
                                      <Upload className="h-6 w-6 text-slate-400 mb-1.5" />
                                      <span className="block text-xs font-bold text-slate-600">{isAadharField && vals.length === 1 ? 'Upload Back Side' : 'Upload from Device'}</span>
                                      <span className="block text-[9px] text-slate-400 mt-0.5">Select image from gallery/files</span>
                                      <input
                                        type="file"
                                        required={f.is_required && vals.length === 0}
                                        accept="image/*"
                                        multiple={isAadharField}
                                        onChange={(e) => handleFileUpload(f.field_name, e, isAadharField)}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>
                                ) : (
                                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-violet-500 hover:bg-violet-500/5 py-6 rounded-2xl cursor-pointer transition">
                                    <div className="text-center">
                                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                                      <span className="block text-xs font-bold text-slate-600">Choose file or drag here</span>
                                      <span className="block text-[9px] text-slate-400 mt-0.5">Images and PDF up to 10MB</span>
                                    </div>
                                    <input
                                      type="file"
                                      required={f.is_required && vals.length === 0}
                                      accept={f.field_type === 'Single PDF Upload' ? '.pdf' : '*'}
                                      onChange={(e) => handleFileUpload(f.field_name, e, false)}
                                      className="hidden"
                                    />
                                  </label>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                  {/* 14. Multiple File uploads */}
                  {['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type) && (
                    (() => {
                      const labelLower = (f.label || '').toLowerCase();
                      const fieldNameLower = (f.field_name || '').toLowerCase();
                      const isAadharField = labelLower.includes('aadhar') || labelLower.includes('aadhaar') || fieldNameLower.includes('aadhar') || fieldNameLower.includes('aadhaar');
                      const hasFiles = value && Array.isArray(value) && value.length > 0;
                      
                      return (
                        <div className="space-y-3">
                          {hasFiles && (
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
                          
                          {isAadharField && hasFiles && (
                            <button
                              type="button"
                              onClick={() => triggerAadharExtraction(value)}
                              disabled={ocrLoading}
                              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
                            >
                              <Sparkles className={`h-4 w-4 ${ocrLoading ? 'animate-spin' : 'animate-pulse'}`} />
                              <span>{ocrLoading ? 'Extracting Details...' : 'Done & Extract Aadhaar Details'}</span>
                            </button>
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
                      );
                    })()
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
                    <span>{selectedPatientId ? 'Update Patient' : 'Register Patient'}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* CAMERA CAPTURE MODAL */}
      {activeCameraField && (() => {
        const isAadhar = isFieldAadhar(activeCameraField);

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-xl p-5 sm:p-6 flex flex-col space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`p-1.5 rounded-lg ${isAadhar ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-700'}`}>
                      <Camera className="h-4 w-4" />
                    </span>
                    <h4 className="text-base font-bold text-slate-800">
                      {isAadhar ? 'Aadhaar Card Scanner' : 'Capture Photo'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {isAadhar 
                      ? (aadharCaptureStep === 'front' 
                          ? 'Step 1 of 2: Capture Front Side (Name, DOB, Gender, Photo)' 
                          : aadharCaptureStep === 'front_preview'
                            ? 'Step 1 of 2: Review Front Side'
                            : aadharCaptureStep === 'back'
                              ? 'Step 2 of 2: Capture Back Side (Address & Pincode)'
                              : 'Review Both Sides before Extracting')
                      : 'Capture document or participant photo'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Aadhaar Stepper Progress Indicator */}
              {isAadhar && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition ${
                    (aadharCaptureStep === 'front' || aadharCaptureStep === 'front_preview')
                      ? 'bg-violet-600 text-white shadow-sm'
                      : aadharFront.blob || aadharFront.isExisting
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-400'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      aadharFront.blob || aadharFront.isExisting ? 'bg-emerald-600 text-white' : 'bg-white/20'
                    }`}>
                      {aadharFront.blob || aadharFront.isExisting ? '✓' : '1'}
                    </span>
                    <span className="truncate">1. Front Side</span>
                  </div>

                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition ${
                    aadharCaptureStep === 'back'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : aadharCaptureStep === 'both_preview'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-400'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      aadharCaptureStep === 'both_preview' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {aadharCaptureStep === 'both_preview' ? '✓' : '2'}
                    </span>
                    <span className="truncate">2. Back Side</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl flex items-center font-semibold">
                  <AlertCircle className="h-4 w-4 mr-2 text-rose-500 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Warning / Quality Message */}
              {cameraWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start font-semibold">
                  <AlertCircle className="h-4 w-4 mr-2 text-amber-600 shrink-0 mt-0.5" />
                  <span>{cameraWarning}</span>
                </div>
              )}

              {/* Main Content Area */}
              {isAadhar && aadharCaptureStep === 'both_preview' ? (
                /* Case 1: Both Sides Captured & Ready */
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs text-indigo-950 font-bold">
                    <span className="flex items-center">
                      <Sparkles className="h-4 w-4 mr-1.5 text-indigo-600 shrink-0" />
                      Both sides captured! Ready for combined autofill.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Front Side Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">1. Front Side (Name/DOB)</span>
                        <button
                          type="button"
                          onClick={handleRetakeFront}
                          className="text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition"
                        >
                          Retake
                        </button>
                      </div>
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-300">
                        {aadharFront.previewUrl ? (
                          <img src={aadharFront.previewUrl} alt="Front" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                            Front Captured
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Back Side Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">2. Back Side (Address)</span>
                        <button
                          type="button"
                          onClick={handleRetakeBack}
                          className="text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition"
                        >
                          Retake
                        </button>
                      </div>
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-300">
                        {aadharBack.previewUrl ? (
                          <img src={aadharBack.previewUrl} alt="Back" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                            Back Captured
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : isAadhar && aadharCaptureStep === 'front_preview' ? (
                /* Case 2: Front Preview Mode */
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center shadow-inner">
                    <img src={aadharFront.previewUrl} alt="Aadhaar Front" className="w-full h-full object-contain" />
                    <div className="absolute top-3 left-3 bg-violet-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                      ✓ Front Side Captured
                    </div>
                  </div>
                  <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl flex items-center space-x-2 text-xs text-violet-800 font-medium">
                    <Sparkles className="h-4 w-4 text-violet-600 shrink-0" />
                    <span>Front side captured! Now click <b>"Next: Capture Back Side"</b> to scan address & pincode.</span>
                  </div>
                </div>
              ) : (
                /* Case 3: Live Video Stream */
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center shadow-inner">
                  {cameraLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 bg-slate-950/80 z-10">
                      <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                      <span className="text-[11px] text-slate-400 font-semibold">Initializing Camera stream...</span>
                    </div>
                  )}

                  {!isAadhar && capturedImage ? (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {/* Aadhaar Alignment Guide Overlay */}
                      {isAadhar && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                          <div className="w-[90%] h-[80%] border-2 border-dashed border-white/70 rounded-2xl flex flex-col justify-between p-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
                            <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded self-start">
                              {aadharCaptureStep === 'back' ? 'Align Back Side (Address & Pincode)' : 'Align Front Side (Photo & Name)'}
                            </span>
                            <span className="text-[9px] text-white/80 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded self-center">
                              Keep card flat and text clearly visible
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>

                {/* Aadhaar Flow Buttons */}
                {isAadhar ? (
                  <div className="flex items-center space-x-2">
                    {aadharCaptureStep === 'front' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Switch Cam
                        </button>
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={cameraLoading || !!cameraError}
                          className="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-600/10 active:scale-95 transition disabled:opacity-50"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Capture Front Side</span>
                        </button>
                      </>
                    )}

                    {aadharCaptureStep === 'front_preview' && (
                      <>
                        <button
                          type="button"
                          onClick={handleRetakeFront}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Retake Front
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseBothAadharPhotos(true)}
                          className="px-3 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl transition underline"
                          title="Use front side only if back side is not available"
                        >
                          Front Only
                        </button>
                        <button
                          type="button"
                          onClick={handleProceedToBack}
                          className="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-600/10 active:scale-95 transition"
                        >
                          <span>Next: Capture Back</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {aadharCaptureStep === 'back' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAadharCaptureStep('front_preview')}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Back to Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Switch Cam
                        </button>
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={cameraLoading || !!cameraError}
                          className="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-600/10 active:scale-95 transition disabled:opacity-50"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Capture Back Side</span>
                        </button>
                      </>
                    )}

                    {aadharCaptureStep === 'both_preview' && (
                      <button
                        type="button"
                        onClick={() => handleUseBothAadharPhotos(false)}
                        className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 sm:px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 active:scale-95 transition"
                      >
                        <Check className="h-4 w-4" />
                        <span>Use Both Photos & Extract Details</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* Standard Non-Aadhaar Flow Buttons */
                  <div className="flex items-center space-x-2">
                    {!capturedImage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                          className="px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Switch Cam
                        </button>
                        <button
                          type="button"
                          onClick={handleCapture}
                          disabled={cameraLoading || !!cameraError}
                          className="flex items-center space-x-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-violet-600/10 active:scale-95 transition disabled:opacity-50"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Capture</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={handleUsePhoto}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 active:scale-95 transition"
                        >
                          <Check className="h-4 w-4" />
                          <span>Use Photo</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ParticipantSubmit;
