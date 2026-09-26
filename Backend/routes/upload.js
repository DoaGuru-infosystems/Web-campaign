const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File Filtering (Images + PDFs)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (PNG, JPG, JPEG, GIF, WEBP, SVG) and PDFs are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024 // Increased limit: 25MB
  }
});

// Async Upload API
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Return file details
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      originalname: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message || 'File upload failed.' });
  }
});

// Aadhar Card OCR Extraction API
const { extractAadharDetails } = require('../utils/aadharParser');
router.post('/extract-aadhar', async (req, res, next) => {
  try {
    const { filename, originalname, files } = req.body;

    // Handle multiple files
    if (files && Array.isArray(files) && files.length > 0) {
      console.log(`Processing multiple files for Aadhaar extraction: ${files.length} files`);
      const allResults = [];
      
      for (const file of files) {
        if (!file.filename) continue;
        const ext = path.extname(file.filename).toLowerCase();
        if (ext === '.pdf') {
          console.log(`Skipping PDF file in multi-extraction: ${file.filename}`);
          continue;
        }

        const filePath = path.join(__dirname, '../uploads', file.filename);
        if (fs.existsSync(filePath)) {
          const details = await extractAadharDetails(filePath, file.originalname || file.filename);
          allResults.push(details);
        }
      }

      // Merge results with smart Front vs Back candidate classification
      // Front side uniquely contains DOB / Gender
      const frontCandidate = allResults.find(d => d.dob || d.gender) || allResults[0] || {};
      // Back side uniquely contains Address / Pincode
      const backCandidate = allResults.find(d => (d.address || d.pincode) && d !== frontCandidate) || 
                            allResults.find(d => d.address || d.pincode) || 
                            allResults[1] || {};

      const mergedDetails = {
        name: frontCandidate.name || backCandidate.name || '',
        dob: frontCandidate.dob || backCandidate.dob || '',
        gender: frontCandidate.gender || backCandidate.gender || '',
        aadharNumber: frontCandidate.aadharNumber || backCandidate.aadharNumber || '',
        address: backCandidate.address || frontCandidate.address || '',
        fullAddress: backCandidate.fullAddress || frontCandidate.fullAddress || backCandidate.address || frontCandidate.address || '',
        city: backCandidate.city || frontCandidate.city || '',
        district: backCandidate.district || frontCandidate.district || '',
        state: backCandidate.state || frontCandidate.state || '',
        pincode: backCandidate.pincode || frontCandidate.pincode || ''
      };

      // Fallback: fill any missing fields from any candidate
      for (const details of allResults) {
        if (!mergedDetails.name && details.name) mergedDetails.name = details.name;
        if (!mergedDetails.dob && details.dob) mergedDetails.dob = details.dob;
        if (!mergedDetails.gender && details.gender) mergedDetails.gender = details.gender;
        if (!mergedDetails.aadharNumber && details.aadharNumber) mergedDetails.aadharNumber = details.aadharNumber;
        if (!mergedDetails.address && details.address) mergedDetails.address = details.address;
        if (!mergedDetails.fullAddress && details.fullAddress) mergedDetails.fullAddress = details.fullAddress;
        if (!mergedDetails.city && details.city) mergedDetails.city = details.city;
        if (!mergedDetails.district && details.district) mergedDetails.district = details.district;
        if (!mergedDetails.state && details.state) mergedDetails.state = details.state;
        if (!mergedDetails.pincode && details.pincode) mergedDetails.pincode = details.pincode;
      }

      return res.json({
        message: 'Multiple Aadhaar details extracted and merged successfully',
        data: mergedDetails
      });
    }

    // Fallback to single file
    if (!filename) {
      return res.status(400).json({ error: 'Filename or files array is required.' });
    }

    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') {
      console.log('Aadhar PDF uploaded. OCR parsing skipped (PDF reading not supported by Tesseract).');
      return res.json({
        message: 'PDF files are not supported for OCR extraction. Please fill in the fields manually or upload a clear image (JPG/PNG).',
        data: {
          name: '',
          dob: '',
          gender: '',
          aadharNumber: '',
          address: '',
          city: '',
          district: '',
          state: '',
          pincode: ''
        }
      });
    }

    const filePath = path.join(__dirname, '../uploads', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server.' });
    }

    const details = await extractAadharDetails(filePath, originalname || filename);
    res.json({
      message: 'Aadhar details extracted successfully',
      data: details
    });
  } catch (err) {
    console.error('Aadhar extraction error:', err);
    res.status(500).json({ error: err.message || 'Aadhar details extraction failed.' });
  }
});

// Error handling middleware for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
