const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ---------------------------------------------------------------------------
// SINGLE WORKER — load the model ONCE, reuse for every OCR call.
// This alone cuts runtime from ~5 min to ~20–30 sec.
// ---------------------------------------------------------------------------
let _worker = null;

async function getWorker() {
  if (_worker) return _worker;
  // Load BOTH English + Hindi models.
  // Without Hindi (hin), Tesseract misreads Devanagari characters (अर्चना, महिला, पता)
  // as garbage English letters like "Sa l", "I Bo Iy", "Die Erent J" etc.
  _worker = await Tesseract.createWorker("eng+hin", 1, { logger: () => {} });
  return _worker;
}

// ---------------------------------------------------------------------------
// FAST IMAGE PREPROCESSING (Sharp)
// ---------------------------------------------------------------------------
// .median(3) removes salt-and-pepper noise which causes Tesseract's
// "Image too small to scale" error.
// We keep the size at 1600px since the frontend already compresses to this size.
// ---------------------------------------------------------------------------
async function preprocessImage(inputPath, outPath, manualAngle = 0) {
  let img = sharp(inputPath)
    .rotate() // auto-fix EXIF orientation
    .resize({ width: 1600, withoutEnlargement: true, kernel: "lanczos3" })
    .grayscale()
    .normalize() // equalise brightness — safe, no clipping
    .median(3)   // remove noise that causes 2x36 scaling errors
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 }); // moderate sharpen for clarity

  if (manualAngle !== 0) {
    img = img.rotate(manualAngle, { background: { r: 255, g: 255, b: 255 } });
  }

  await img.png().toFile(outPath);
}

// ---------------------------------------------------------------------------
// OCR RUNNER — reuses single worker
// ---------------------------------------------------------------------------
async function runOCR(imagePath, psm = 6) {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  const {
    data: { text },
  } = await worker.recognize(imagePath);
  return text;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SCORING & CONFIDENCE
// ---------------------------------------------------------------------------
function scoreResult(parsed) {
  let score = 0;
  if (parsed.aadharNumber) score += 100;
  if (parsed.dob) score += 60;
  if (parsed.name) score += 60;
  if (parsed.gender) score += 35;
  if (parsed.address) score += 50;
  if (parsed.pincode) score += 40;
  return score;
}

function isHighConfidence(parsed) {
  // Front side complete: Aadhaar number + (name or dob) + gender
  const isFrontDone =
    !!parsed.aadharNumber && (!!parsed.name || !!parsed.dob) && !!parsed.gender;
  // Back side complete: Address + Pincode
  const isBackDone = !!parsed.address && !!parsed.pincode;
  return isFrontDone || isBackDone;
}

// ---------------------------------------------------------------------------
// TEXT PARSER
// ---------------------------------------------------------------------------
function parseAadharText(text) {
  const result = {
    name: "",
    dob: "",
    gender: "",
    aadharNumber: "",
    address: "",
    fullAddress: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
  };

  if (!text || !text.trim()) return result;

  // 1. Aadhaar Number (XXXX XXXX XXXX or 12 digits)
  const aadhaarMatch =
    text.match(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/) || text.match(/\b\d{12}\b/);
  if (aadhaarMatch) {
    result.aadharNumber = aadhaarMatch[0].replace(/[\s-]/g, "");
  }

  // 2. DOB (Support DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YOB)
  const dobMatch = text.match(
    /(?:DOB|D\.O\.B|Date\s*of\s*Birth|जन्म|Year\s*of\s*Birth|YOB)[:\s\/\.\-]+(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i,
  );
  if (dobMatch) {
    result.dob = dobMatch[1].replace(/[\-\.]/g, "/");
  } else {
    // Standalone date fallback
    const dateMatch = text.match(
      /\b([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.](?:19|20)\d{2})\b/,
    );
    if (dateMatch) {
      result.dob = dateMatch[1].replace(/[\-\.]/g, "/");
    } else {
      const yobMatch = text.match(
        /(?:Year\s*of\s*Birth|YOB|जन्म\s*वर्ष)[:\s]+(\d{4})/i,
      );
      if (yobMatch) result.dob = `01/01/${yobMatch[1]}`;
    }
  }

  // 3. Gender (English + Hindi + OCR mangling)
  if (/(?:FEMALE|महिला|स्त्री)/i.test(text)) {
    result.gender = "Female";
  } else if (/(?:MALE|पुरुष)/i.test(text)) {
    result.gender = "Male";
  } else if (/Transgender|अन्य/i.test(text)) {
    result.gender = "Other";
  } else {
    for (const line of text.split("\n")) {
      const u = line.toUpperCase();
      if (/\b(RAL|ALE|\/\s*AL)\b/.test(u)) {
        result.gender = "Male";
        break;
      }
      if (/EMALE|FEMA/.test(u)) {
        result.gender = "Female";
        break;
      }
    }
  }

  // 4. Name — intelligent extraction guarding against government headers
  const SKIP = new Set([
    "government",
    "india",
    "authority",
    "unique",
    "identification",
    "aadhaar",
    "aadhar",
    "enrolment",
    "enrollment",
    "male",
    "female",
    "address",
    "dob",
    "birth",
    "date",
    "year",
    "of",
    "help",
    "proof",
    "identity",
    "citizen",
    "resident",
    "qr",
    "code",
    "mera",
    "meri",
    "pehchan",
    "pehechan",
    "my",
    "our",
    "state",
    "card",
    "vid",
    "virtual",
    "download",
    "issue",
    "information",
    "napier",
    "jabalpur",
    "mumbai",
    "delhi",
    "pune",
    "chennai",
    "kolkata",
    "hyderabad",
    "bangalore",
    "bengaluru",
    "ahmedabad",
    "surat",
    "lucknow",
    "kanpur",
    "nagpur",
    "indore",
    "bhopal",
    "patna",
    "ludhiana",
    "agra",
  ]);

  // Detect if this is likely a back-side card (has address but no DOB/gender)
  const isLikelyBackSide =
    /(?:Address|\u092a\u0924\u093e|c\/o|s\/o|w\/o|d\/o|pin|district)/i.test(text) &&
    !/(?:DOB|\u091c\u0928\u094d\u092e|FEMALE|MALE|\d{2}[\/\-]\d{2}[\/\-]\d{4})/i.test(
      text,
    );

  const isNameCandidate = (line) => {
    if (!line) return false;
    const clean = line.replace(/[^a-zA-Z\s]/g, "").trim();
    if (clean.length < 4 || clean.length > 40) return false;
    if (/\d/.test(line)) return false;
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 5) return false;
    
    // Most Indian names have at least one word >= 3 letters (avoids garbage like "M Ls")
    if (!words.some(w => w.length >= 3)) return false;
    const useful = words.filter((w) => !SKIP.has(w.toLowerCase()));
    if (useful.length === 0) return false;
    // Skip lines that are C/O or relationship indicators
    if (
      /\b(father|mother|husband|wife|son|daughter|care|c\/o|s\/o|w\/o|d\/o|town|road|nagar|colony|street|ward|dist|post|tehsil|village|sector|flat|house|lane|near)\b/i.test(
        line,
      )
    )
      return false;
    // Must have at least one word that starts with uppercase (real names do)
    if (!words.some((w) => w.length > 1 && /^[A-Z]/.test(w))) return false;
    return true;
  };

  const formatName = (raw) =>
    raw
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Phase A: lines directly above DOB (Front side)
  let dobLineIdx = lines.findIndex((l) =>
    /DOB|Date\s*of\s*Birth|\u091c\u0928\u094d\u092e|\d{2}[\/\-]\d{2}[\/\-]\d{4}/i.test(
      l,
    ),
  );
  if (dobLineIdx > 0) {
    for (let off = 1; off <= Math.min(4, dobLineIdx); off++) {
      const cand = lines[dobLineIdx - off];
      if (isNameCandidate(cand)) {
        result.name = formatName(cand);
        break;
      }
    }
  }

  // Phase B: Look for English Name candidate in top lines
  // SKIP Phase B entirely if back-side card (avoids picking up city names from address)
  if (!result.name && !isLikelyBackSide) {
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (isNameCandidate(lines[i])) {
        result.name = formatName(lines[i]);
        break;
      }
    }
  }

  // 5. Address — prefer English "Address:" block, fallback to Hindi पता:, then keyword scan
  let addrText = "";

  // Priority 1: English "Address:" block (most clean)
  const enAddrMatch = text.match(
    /(?:^|\n)[\s]*(?:Address|Addres|Addess)[\s]*[:\-\.]\s*([\s\S]+)/im,
  );
  if (enAddrMatch) {
    addrText = enAddrMatch[1].trim();
  }

  // Priority 2: Hindi पता: block
  if (!addrText) {
    const hiAddrMatch = text.match(
      /(?:^|\n)[\s]*पता[\s]*[:\-\.]?\s*([\s\S]+)/m,
    );
    if (hiAddrMatch) {
      addrText = hiAddrMatch[1].trim();
    }
  }

  // Priority 3: C/O or S/O pattern
  if (!addrText) {
    const careOfMatch = text.match(
      /(?:(?:c|s|w|d)\/o|care\s+of|son\s+of|wife\s+of|daughter\s+of)\s*[:\-\.]?\s*([\s\S]+)/i,
    );
    if (careOfMatch) {
      addrText = careOfMatch[0].trim();
    }
  }

  if (!addrText) {
    const kwds = [
      "c/o",
      "s/o",
      "d/o",
      "w/o",
      "care of",
      "house",
      "ward",
      "village",
      "post",
      "tehsil",
      "dist",
      "road",
      "nagar",
      "gali",
      "colony",
      "flat",
      "sector",
      "lane",
      "near",
    ];
    const addrStart = lines.findIndex((l) =>
      kwds.some((k) => l.toLowerCase().includes(k)),
    );
    if (addrStart !== -1) {
      addrText = lines.slice(addrStart, addrStart + 8).join(", ");
    }
  }

  if (addrText) {
    // Strip helpline / email / website / bottom Aadhaar numbers
    addrText = addrText.replace(/\b1947\b[\s\S]*/i, "");
    addrText = addrText.replace(/help@uidai[\s\S]*/i, "");
    addrText = addrText.replace(/www\.uidai[\s\S]*/i, "");
    addrText = addrText.replace(/\b\d{4}\s+\d{4}\s+\d{4}\b[\s\S]*/, "");

    // 1. Extract and cut off at 6-digit pincode
    const pinMatch = addrText.match(/\b(\d{6})\b/);
    if (pinMatch) {
      result.pincode = pinMatch[1];
      const pinPos = addrText.indexOf(pinMatch[0]);
      if (pinPos !== -1) {
        addrText = addrText.slice(0, pinPos + 6).trim();
      }
    }

    // 2. Extract State
    const INDIAN_STATES = [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Delhi",
      "Jammu and Kashmir",
      "Ladakh",
      "Chandigarh",
      "Puducherry",
    ];
    // Also check for abbreviated/partial state matches from OCR
    const stateAliases = {
      "M.P": "Madhya Pradesh",
      MP: "Madhya Pradesh",
      "U.P": "Uttar Pradesh",
      UP: "Uttar Pradesh",
      "मध्य प्रदेश": "Madhya Pradesh",
      मध्यप्रदेश: "Madhya Pradesh",
      "उत्तर प्रदेश": "Uttar Pradesh",
      महाराष्ट्र: "Maharashtra",
      राजस्थान: "Rajasthan",
      गुजरात: "Gujarat",
      बिहार: "Bihar",
      "W.B": "West Bengal",
      WB: "West Bengal",
    };
    if (!result.state) {
      for (const [alias, fullName] of Object.entries(stateAliases)) {
        if (addrText.includes(alias) || text.includes(alias)) {
          result.state = fullName;
          break;
        }
      }
    }

    for (const state of INDIAN_STATES) {
      const stateRegex = new RegExp(
        "\\b" + state.replace(/\s+/g, "\\s*") + "\\b",
        "i",
      );
      if (stateRegex.test(addrText)) {
        result.state = state;
        break;
      }
    }

    // Strip all Hindi (Devanagari) characters as we only want the English address
    addrText = addrText.replace(/[\u0900-\u097F]+/g, "");

    // Clean address
    let cleanAddr = addrText
      .replace(/[\r\n]+/g, ", ")
      .replace(/[\|\=\_\{\}\[\]]/g, " ") // remove stray OCR symbols
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,+/g, ", ")
      .replace(/\.\s*\.+/g, ".") // fix multiple dots
      .replace(/^[,\s\-:\.]+(?=[A-Za-z0-9])/g, "") // trim starting garbage
      .replace(/[,\s\-:\.]+$/, "")
      .trim();

    result.address = cleanAddr;
    result.fullAddress = cleanAddr;

    const parts = cleanAddr
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      result.district = parts[parts.length - 2];
      result.city = parts[parts.length - 3] || parts[parts.length - 2];
    } else if (parts.length >= 1) {
      result.district = parts[parts.length - 1];
      result.city = parts[0];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// MAIN EXPORT — 2-pass, early-exit strategy
// ---------------------------------------------------------------------------
async function extractAadharDetails(filePath, originalName = "") {
  if (path.extname(filePath).toLowerCase() === ".pdf") {
    console.log("[Aadhaar] PDF — OCR skipped.");
    return emptyResult();
  }
  if (!fs.existsSync(filePath)) {
    console.error("[Aadhaar] File not found:", filePath);
    return emptyResult();
  }

  const tempDir = path.dirname(filePath);
  const tmpBase = path.join(tempDir, `ocr_${Date.now()}`);
  const tmpFiles = [];

  let bestResult = emptyResult();
  let bestScore = -1;

  try {
    // ── PASS 1: Standard orientation, PSM 3 (Auto page segmentation) ──
    // PSM 3 is robust against noise and prevents "Image too small to scale" errors
    const p1 = `${tmpBase}_main.png`;
    tmpFiles.push(p1);
    await preprocessImage(filePath, p1, 0);

    console.log("[OCR] Pass1 psm=3");
    let raw = await runOCR(p1, 3);
    let parsed = parseAadharText(raw);
    let score = scoreResult(parsed);
    console.log(
      `[OCR] score=${score} name="${parsed.name}" dob=${parsed.dob} aadhaar=${parsed.aadharNumber} gender=${parsed.gender}`,
    );

    if (score > bestScore) {
      bestScore = score;
      bestResult = parsed;
    }
    if (isHighConfidence(parsed)) {
      console.log("[OCR] High-confidence Pass1 psm=3 — done.");
      return parsed;
    }

    // ── PASS 1B: PSM 4 (Assume a single column of text of variable sizes) ──
    console.log("[OCR] Pass1 psm=4");
    raw = await runOCR(p1, 4);
    parsed = parseAadharText(raw);
    score = scoreResult(parsed);
    console.log(
      `[OCR] score=${score} name="${parsed.name}" dob=${parsed.dob} aadhaar=${parsed.aadharNumber} gender=${parsed.gender}`,
    );

    if (score > bestScore) {
      bestScore = score;
      bestResult = parsed;
    }
    if (isHighConfidence(parsed)) {
      console.log("[OCR] High-confidence Pass1 psm=11 — done.");
      return parsed;
    }

    // ── PASS 2: Only try 180° rotation (scans/screenshots often upside-down) ──
    // Skip 90°/270° — phone photos are never sideways (EXIF auto-corrects them)
    for (const angle of [180, 90]) {
      const p2 = `${tmpBase}_rot${angle}.png`;
      tmpFiles.push(p2);
      await preprocessImage(filePath, p2, angle);

      console.log(`[OCR] Pass2 angle=${angle}°`);
      raw = await runOCR(p2, 3); // use PSM 3 here too
      parsed = parseAadharText(raw);
      score = scoreResult(parsed);
      console.log(
        `[OCR] score=${score} name="${parsed.name}" dob=${parsed.dob} aadhaar=${parsed.aadharNumber} gender=${parsed.gender}`,
      );

      if (score > bestScore) {
        bestScore = score;
        bestResult = parsed;
      }
      if (isHighConfidence(parsed)) {
        console.log(`[OCR] High-confidence rot${angle} — done.`);
        return parsed;
      }
    }
  } finally {
    for (const f of tmpFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch (_) {}
    }
  }

  console.log("[OCR] Best score:", bestScore);
  return bestResult;
}

function emptyResult() {
  return {
    name: "",
    dob: "",
    gender: "",
    aadharNumber: "",
    address: "",
    fullAddress: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
  };
}

module.exports = { extractAadharDetails, parseAadharText };
