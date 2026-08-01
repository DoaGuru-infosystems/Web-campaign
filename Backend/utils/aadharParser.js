const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ---------------------------------------------------------------------------
// SINGLE WORKER — load the model ONCE, reuse for every OCR call.
// This alone cuts runtime from ~5 min to ~20–30 sec.
// ---------------------------------------------------------------------------
let _worker = null;

async function getWorker() {
  if (_worker) return _worker;
  _worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
  return _worker;
}

// ---------------------------------------------------------------------------
// FAST IMAGE PREPROCESSING (Sharp)
// ---------------------------------------------------------------------------
// We use ONE proven strategy: 3× upscale + grayscale + normalize + sharpen.
// The upscale is the single biggest accuracy gain on small Aadhaar photos.
// ---------------------------------------------------------------------------
async function preprocessImage(inputPath, outPath, manualAngle = 0) {
  let img = sharp(inputPath)
    .rotate()                              // honour EXIF orientation (free fix)
    .resize({ width: 1600, kernel: 'lanczos3' })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 });

  if (manualAngle !== 0) {
    img = img.rotate(manualAngle);
  }

  await img.png().toFile(outPath);
}

// ---------------------------------------------------------------------------
// OCR RUNNER — reuses single worker
// ---------------------------------------------------------------------------
async function runOCR(imagePath, psm = 6) {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const { data: { text } } = await worker.recognize(imagePath);
  return text;
}

// ---------------------------------------------------------------------------
// SCORING & CONFIDENCE
// ---------------------------------------------------------------------------
function scoreResult(parsed) {
  let score = 0;
  if (parsed.aadharNumber) score += 100;
  if (parsed.dob)          score += 60;
  if (parsed.name)         score += 60;
  if (parsed.gender)       score += 35;
  if (parsed.address)      score += 20;
  if (parsed.pincode)      score += 15;
  return score;
}

function isHighConfidence(parsed) {
  // Stop early when we have all 4 key fields
  return !!parsed.aadharNumber && !!parsed.name && !!parsed.dob && !!parsed.gender;
}

// ---------------------------------------------------------------------------
// TEXT PARSER
// ---------------------------------------------------------------------------
function parseAadharText(text) {
  const result = {
    name: '', dob: '', gender: '', aadharNumber: '',
    address: '', city: '', district: '', state: '', pincode: '',
  };

  if (!text || !text.trim()) return result;

  // 1. Aadhaar Number (XXXX XXXX XXXX or 12 digits)
  const aadhaarMatch = text.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/);
  if (aadhaarMatch) {
    result.aadharNumber = aadhaarMatch[0].replace(/[\s-]/g, '');
  }

  // 2. DOB
  const dobMatch = text.match(
    /(?:DOB|D\.O\.B|Date\s*of\s*Birth|जन्म)[:\s/-]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
  );
  if (dobMatch) result.dob = dobMatch[1].replace(/-/g, '/');

  if (!result.dob) {
    const yobMatch = text.match(/(?:Year\s*of\s*Birth|YOB)[:\s]+(\d{4})/i);
    if (yobMatch) result.dob = `01/01/${yobMatch[1]}`;
  }

  // 3. Gender — exact match first, then fuzzy (OCR mangling of Hindi+MALE)
  const genderExact = text.match(/\b(MALE|FEMALE|Transgender)\b/i);
  if (genderExact) {
    const g = genderExact[1].toUpperCase();
    result.gender = g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : 'Other';
  } else {
    // Tesseract reads "सुन्/ MALE" as fragments like "RAL", "ALE", "/ AL"
    // when Hindi characters bleed into the English token.
    for (const line of text.split('\n')) {
      const u = line.toUpperCase();
      if (/\bRAL\b|\bALE\b|\/\s*AL\b/.test(u)) { result.gender = 'Male';   break; }
      if (/EMALE|FEMA/.test(u))                  { result.gender = 'Female'; break; }
    }
  }

  // 4. Name — look for multi-word English-only lines
  const SKIP = new Set([
    'government','india','authority','unique','identification',
    'aadhaar','aadhar','enrolment','enrollment','male','female',
    'address','dob','birth','date','year','of','help',
    'proof','identity','citizen','resident','qr','code',
  ]);

  const isNameCandidate = (line) => {
    const clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
    if (clean.length < 4) return false;
    if (!/^[a-zA-Z\s]+$/.test(clean)) return false;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 2) return false;
    const useful = words.filter(w => !SKIP.has(w.toLowerCase()));
    return useful.length > 0;
  };

  const formatName = (raw) =>
    raw.replace(/[^a-zA-Z\s]/g, '').trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Find DOB line index to look above it
  let dobLineIdx = lines.findIndex(l => /DOB|Date\s*of\s*Birth|जन्म/i.test(l));

  // Phase A: lines above DOB
  if (dobLineIdx > 0) {
    for (let off = 1; off <= Math.min(4, dobLineIdx); off++) {
      const cand = lines[dobLineIdx - off];
      if (isNameCandidate(cand)) { result.name = formatName(cand); break; }
    }
  }

  // Phase B: ALL-CAPS English name in first 12 lines
  if (!result.name) {
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      if (/^[A-Z][A-Z\s]{4,}$/.test(lines[i]) && isNameCandidate(lines[i])) {
        result.name = formatName(lines[i]);
        break;
      }
    }
  }

  // Phase C: any English name in first 12 lines
  if (!result.name) {
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      if (isNameCandidate(lines[i])) { result.name = formatName(lines[i]); break; }
    }
  }

  // 5. Address
  let addrText = '';
  const addrIdx = text.toLowerCase().indexOf('address:');
  const pataIdx = text.indexOf('पता:');
  const coIdx   = text.toLowerCase().search(/\bc\/o\b/);
  const soIdx   = text.toLowerCase().search(/\bs\/o\b/);

  if      (addrIdx !== -1) addrText = text.slice(addrIdx + 8).trim();
  else if (pataIdx !== -1) addrText = text.slice(pataIdx + 3).trim();
  else if (coIdx   !== -1) addrText = text.slice(coIdx).trim();
  else if (soIdx   !== -1) addrText = text.slice(soIdx).trim();

  if (!addrText) {
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
    // 1. Extract and remove pincode
    const pinMatch = addrText.match(/\b(\d{6})\b/);
    if (pinMatch) {
      result.pincode = pinMatch[1];
      addrText = addrText.replace(pinMatch[0], '').trim();
    }

    // Clean up carriage returns/newlines and excessive spaces
    addrText = addrText.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    // 2. Extract and remove State dynamically matching Indian States list
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

    // Clean up trailing punctuation like hyphens, commas, slashes, or trailing spaces
    addrText = addrText.replace(/[\s-,\/]+$/, '').trim();

    // 3. Split remaining address by commas
    let parts = addrText.split(',').map(p => p.trim()).filter(Boolean);

    // 4. Remove care-of / parentage prefixes (C/O, S/O, D/O, W/O etc.)
    const isCareOf = /^(c\/o|s\/o|d\/o|w\/o|care\s+of|son\s+of|daughter\s+of|wife\s+of)\b/i;
    parts = parts.filter(part => !isCareOf.test(part));

    // 5. Assign relative address components backwards
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

  return result;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT — 2-pass, early-exit strategy
// ---------------------------------------------------------------------------
async function extractAadharDetails(filePath, originalName = '') {
  if (path.extname(filePath).toLowerCase() === '.pdf') {
    console.log('[Aadhaar] PDF — OCR skipped.');
    return emptyResult();
  }
  if (!fs.existsSync(filePath)) {
    console.error('[Aadhaar] File not found:', filePath);
    return emptyResult();
  }

  const tempDir  = path.dirname(filePath);
  const tmpBase  = path.join(tempDir, `ocr_${Date.now()}`);
  const tmpFiles = [];

  let bestResult = emptyResult();
  let bestScore  = -1;

  try {
    // ── PASS 1: EXIF auto-orient only (covers ~90% of real phone photos) ──
    // Single strategy + 2 PSM modes
    const p1 = `${tmpBase}_pass1.png`;
    tmpFiles.push(p1);
    await preprocessImage(filePath, p1, 0);

    for (const psm of [6, 11]) {
      console.log(`[OCR] Pass1 psm=${psm}`);
      const raw    = await runOCR(p1, psm);
      const parsed = parseAadharText(raw);
      const score  = scoreResult(parsed);
      console.log(`[OCR] score=${score} name="${parsed.name}" dob=${parsed.dob} aadhaar=${parsed.aadharNumber} gender=${parsed.gender}`);

      if (score > bestScore) { bestScore = score; bestResult = parsed; }
      if (isHighConfidence(parsed)) {
        console.log('[OCR] High-confidence on Pass1 — done.');
        return parsed;
      }
    }

    // ── PASS 2: Manual rotations (for scans/screenshots without EXIF) ──
    // Only 3 angles (skip 0 since Pass1 already tried it) × 1 PSM each
    for (const angle of [90, 180, 270]) {
      const p2 = `${tmpBase}_rot${angle}.png`;
      tmpFiles.push(p2);
      await preprocessImage(filePath, p2, angle);

      console.log(`[OCR] Pass2 angle=${angle}°`);
      const raw    = await runOCR(p2, 6);
      const parsed = parseAadharText(raw);
      const score  = scoreResult(parsed);
      console.log(`[OCR] score=${score} name="${parsed.name}" dob=${parsed.dob} aadhaar=${parsed.aadharNumber} gender=${parsed.gender}`);

      if (score > bestScore) { bestScore = score; bestResult = parsed; }
      if (isHighConfidence(parsed)) {
        console.log('[OCR] High-confidence on Pass2 — done.');
        return parsed;
      }
    }

  } finally {
    for (const f of tmpFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    }
  }

  console.log('[OCR] Best score:', bestScore);
  return bestResult;
}

function emptyResult() {
  return {
    name: '', dob: '', gender: '', aadharNumber: '',
    address: '', city: '', district: '', state: '', pincode: '',
  };
}

module.exports = { extractAadharDetails, parseAadharText };
