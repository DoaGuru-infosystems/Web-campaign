export interface AadharData {
  name: string;
  dob: string;
  gender: string;
  aadharNumber: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export function parseAadharText(text: string): AadharData {
  const result: AadharData = {
    name: '',
    dob: '',
    gender: '',
    aadharNumber: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
  };

  if (!text || !text.trim()) return result;

  // 1. Aadhaar Number (Exclude 16-digit VID number to prevent mismatch)
  let cleanText = text;
  cleanText = cleanText.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, ' ');
  const aadhaarMatch = cleanText.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  if (aadhaarMatch) {
    result.aadharNumber = aadhaarMatch[0].replace(/[\s-]/g, '');
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 2. DOB / YOB
  const dobMatch = text.match(
    /(?:DOB|D\.O\.B|Date\s*of\s*Birth|जन्म|tithi)[:\s/-]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
  );
  if (dobMatch) {
    result.dob = dobMatch[1].replace(/-/g, '/');
  } else {
    const yobMatch = text.match(/(?:Year\s*of\s*Birth|YOB)[:\s]+(\d{4})/i);
    if (yobMatch) result.dob = `01/01/${yobMatch[1]}`;
  }

  // 3. Gender
  const genderExact = text.match(/\b(MALE|FEMALE|Transgender)\b/i);
  if (genderExact) {
    const g = genderExact[1].toUpperCase();
    result.gender = g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other';
  } else {
    for (const line of lines) {
      const u = line.toUpperCase();
      if (/\bRAW\b|\bRAL\b|\bALE\b|\/\s*AL\b/.test(u)) {
        result.gender = 'Male';
        break;
      }
      if (/EMALE|FEMA/.test(u)) {
        result.gender = 'Female';
        break;
      }
    }
  }

  // 4. Name extraction
  const SKIP = new Set([
    'government', 'india', 'authority', 'unique', 'identification',
    'aadhaar', 'aadhar', 'enrolment', 'enrollment', 'male', 'female',
    'address', 'dob', 'birth', 'date', 'year', 'of', 'help',
    'proof', 'identity', 'citizen', 'resident', 'qr', 'code',
    'vid', 'virtual',
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

  let dobLineIdx = lines.findIndex(l => /DOB|Date\s*of\s*Birth|जन्म|Tithi/i.test(l));

  if (dobLineIdx > 0) {
    for (let offset = 1; offset <= Math.min(3, dobLineIdx); offset++) {
      const candidate = lines[dobLineIdx - offset];
      const cleanCand = candidate.replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleanCand.length >= 3 && !/government|india|unique|authority|identification|enrolment|vid|virtual/i.test(cleanCand)) {
        result.name = formatName(candidate);
        break;
      }
    }
  }

  if (!result.name) {
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      const line = lines[i];
      if (/^[A-Z][A-Z\s]{4,}$/.test(line) && isNameCandidate(line)) {
        result.name = formatName(line);
        break;
      }
    }
  }

  if (!result.name) {
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      const line = lines[i];
      if (isNameCandidate(line)) {
        result.name = formatName(line);
        break;
      }
    }
  }

  // 5. Address extraction
  let addrText = '';
  const addressMatch = text.match(/\baddres[s]?\b[:\s]*/i);
  const pataMatch = text.match(/\bपता\b[:\s]*/);
  const coMatch = text.match(/\bc\/o\b[:\s]*/i);
  const soMatch = text.match(/\bs\/o\b[:\s]*/i);

  if (addressMatch && addressMatch.index !== undefined) {
    addrText = text.slice(addressMatch.index + addressMatch[0].length).trim();
  } else if (pataMatch && pataMatch.index !== undefined) {
    addrText = text.slice(pataMatch.index + pataMatch[0].length).trim();
  } else if (coMatch && coMatch.index !== undefined) {
    addrText = text.slice(coMatch.index).trim();
  } else if (soMatch && soMatch.index !== undefined) {
    addrText = text.slice(soMatch.index).trim();
  }

  if (!addrText) {
    const kwds = ['c/o', 's/o', 'd/o', 'w/o', 'father', 'house', 'ward', 'village', 'dist'];
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
    const pinMatch = addrText.match(/\b\d{6}\b/);
    if (pinMatch) {
      result.pincode = pinMatch[0];
      let addrBody = addrText.substring(0, addrText.indexOf(result.pincode)).trim();
      addrBody = addrBody.replace(/[-\s]+$/, '').trim();

      const STATES = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
        'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
        'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 
        'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Jammu and Kashmir', 'Puducherry'
      ];

      let stateFound = '';
      for (const s of STATES) {
        const regex = new RegExp(`\\b${s}\\b`, 'i');
        if (regex.test(addrBody)) {
          stateFound = s;
          addrBody = addrBody.replace(regex, '').trim();
          break;
        }
      }
      result.state = stateFound || 'Madhya Pradesh';
      addrBody = addrBody.replace(/^[,-\s]+|[,-\s]+$/g, '').trim();

      const commaParts = addrBody.split(',').map(p => p.trim()).filter(Boolean);
      if (commaParts.length >= 2) {
        result.district = commaParts[commaParts.length - 1];
        result.city = commaParts[commaParts.length - 2];
        const addressParts = commaParts.slice(0, commaParts.length - 2);
        let finalAddr = addressParts.join(', ').trim();
        finalAddr = finalAddr.replace(/^(Address|पता)[:\s,]+/i, '').trim();
        result.address = finalAddr;
      } else if (commaParts.length === 1) {
        let finalAddr = commaParts[0].replace(/^(Address|पता)[:\s,]+/i, '').trim();
        result.city = finalAddr;
        result.district = finalAddr;
        result.address = finalAddr;
      }
    } else {
      result.address = addrText.replace(/^(Address|पता)[:\s,]+/i, '').trim();
    }
  }

  return result;
}
