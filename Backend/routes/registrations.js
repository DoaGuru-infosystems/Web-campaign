const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

// Validation helper
function validateField(val, field) {
  const rules = typeof field.validation_rules === 'string' ? JSON.parse(field.validation_rules) : (field.validation_rules || {});
  
  if (field.is_required && (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0))) {
    return `Field "${field.label}" is required.`;
  }

  if (val === undefined || val === null || val === '') return null; // If not required and empty, skip rest

  // String length checks
  if (typeof val === 'string') {
    if (rules.min_length && val.length < parseInt(rules.min_length)) {
      return `"${field.label}" must be at least ${rules.min_length} characters long.`;
    }
    if (rules.max_length && val.length > parseInt(rules.max_length)) {
      return `"${field.label}" cannot exceed ${rules.max_length} characters.`;
    }
  }

  // Numeric checks
  if (field.field_type === 'Number' || field.field_type === 'Age') {
    const num = Number(val);
    if (isNaN(num)) {
      return `"${field.label}" must be a valid number.`;
    }
    if (rules.min_value !== undefined && rules.min_value !== null && num < Number(rules.min_value)) {
      return `"${field.label}" must be at least ${rules.min_value}.`;
    }
    if (rules.max_value !== undefined && rules.max_value !== null && num > Number(rules.max_value)) {
      return `"${field.label}" cannot exceed ${rules.max_value}.`;
    }
  }

  // Email format check
  if (field.field_type === 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return `"${field.label}" must be a valid email address.`;
    }
  }

  // Phone validation check
  if (field.field_type === 'Phone Number') {
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!phoneRegex.test(val)) {
      return `"${field.label}" must be a valid phone number.`;
    }
  }

  return null;
}

// 1. Submit Registration (Public)
router.post('/', async (req, res) => {
  const { campaign_id, submitted_data } = req.body;

  if (!campaign_id || !submitted_data) {
    return res.status(400).json({ error: 'Campaign ID and form data are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check if campaign exists and is active/published
    const [camps] = await conn.query('SELECT * FROM campaigns WHERE id = ? FOR UPDATE', [campaign_id]);
    if (camps.length === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }
    const campaign = camps[0];

    if (campaign.status !== 'Published') {
      return res.status(400).json({ error: 'This campaign is not accepting registrations.' });
    }

    // Check expiry
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(campaign.end_date).toISOString().split('T')[0];
    if (endDate < today) {
      return res.status(400).json({ error: 'This campaign has expired and registrations are closed.' });
    }

    // Check submission limit
    if (campaign.submission_limit !== null) {
      const [regCount] = await conn.query('SELECT COUNT(*) AS total FROM registrations WHERE campaign_id = ?', [campaign_id]);
      if (regCount[0].total >= campaign.submission_limit) {
        return res.status(400).json({ error: 'This campaign has reached its registration limit.' });
      }
    }

    // 2. Fetch campaign fields for validation
    const [fields] = await conn.query('SELECT * FROM campaign_fields WHERE campaign_id = ?', [campaign_id]);
    const validationErrors = [];

    for (let f of fields) {
      const value = submitted_data[f.field_name];
      const errorMsg = validateField(value, f);
      if (errorMsg) {
        validationErrors.push(errorMsg);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    // 3. Auto-generate Registration ID
    // Find count of registrations with the same prefix and ensure global uniqueness
    const prefix = campaign.registration_id_prefix || 'CMP-2026';
    let currentCount = 0;
    let regId = '';
    let isUnique = false;

    const [countResult] = await conn.query('SELECT COUNT(*) AS total FROM registrations WHERE registration_id LIKE ?', [`${prefix}-%`]);
    currentCount = countResult[0].total;

    while (!isUnique) {
      regId = `${prefix}-${(currentCount + 1).toString().padStart(4, '0')}`;
      const [existing] = await conn.query('SELECT id FROM registrations WHERE registration_id = ?', [regId]);
      if (existing.length === 0) {
        isUnique = true;
      } else {
        currentCount++;
      }
    }

    // 4. Save Registration
    const [regResult] = await conn.query(`
      INSERT INTO registrations (campaign_id, registration_id, status, submitted_data) 
      VALUES (?, ?, 'Pending', ?)
    `, [campaign_id, regId, JSON.stringify(submitted_data)]);

    const newRegId = regResult.insertId;

    // 5. Track files uploaded
    // Uploaded files will be parsed out of file fields in submitted_data
    // Expected file field structure in submitted_data:
    // { url: "/uploads/xyz.png", filename: "xyz.png", size: 1234, mimetype: "image/png" }
    // or string path if simple, or arrays for multiple upload fields
    for (let f of fields) {
      if (['Single Image Upload', 'Single PDF Upload', 'Signature Upload', 'File Upload'].includes(f.field_type)) {
        const fileObj = submitted_data[f.field_name];
        if (fileObj && typeof fileObj === 'object' && fileObj.url) {
          await conn.query(`
            INSERT INTO uploaded_files (registration_id, campaign_id, field_name, file_name, file_path, file_type, file_size) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [newRegId, campaign_id, f.field_name, fileObj.filename || 'file', fileObj.url, fileObj.mimetype || 'unknown', fileObj.size || 0]);
        }
      } else if (['Multiple Image Upload', 'Multiple PDF Upload'].includes(f.field_type)) {
        const filesArr = submitted_data[f.field_name];
        if (filesArr && Array.isArray(filesArr)) {
          for (let fileObj of filesArr) {
            if (fileObj && typeof fileObj === 'object' && fileObj.url) {
              await conn.query(`
                INSERT INTO uploaded_files (registration_id, campaign_id, field_name, file_name, file_path, file_type, file_size) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [newRegId, campaign_id, f.field_name, fileObj.filename || 'file', fileObj.url, fileObj.mimetype || 'unknown', fileObj.size || 0]);
            }
          }
        }
      }
    }

    // 6. Log Notification
    await conn.query(`
      INSERT INTO notifications (type, message) 
      VALUES ('Registration Received', ?)
    `, [`New participant registered for "${campaign.title}" with ID ${regId}`]);

    await conn.commit();
    res.status(201).json({
      message: 'Registration submitted successfully!',
      registration_id: regId,
      thank_you_message: campaign.thank_you_message || 'Thank you for your registration!'
    });
  } catch (err) {
    await conn.rollback();
    console.error('Submission error:', err);
    res.status(500).json({ error: 'Failed to submit registration. Please try again.' });
  } finally {
    conn.release();
  }
});

// 2. Track Registration Status (Public)
router.get('/track/:regId', async (req, res) => {
  const { regId } = req.params;
  try {
    const [regs] = await pool.query(`
      SELECT r.*, c.title AS campaign_title, c.banner_url 
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      WHERE r.registration_id = ?
    `, [regId]);

    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration ID not found.' });
    }

    const reg = regs[0];
    res.json({
      registration: {
        registration_id: reg.registration_id,
        status: reg.status,
        submitted_data: typeof reg.submitted_data === 'string' ? JSON.parse(reg.submitted_data) : reg.submitted_data,
        campaign_title: reg.campaign_title,
        banner_url: reg.banner_url,
        created_at: reg.created_at
      }
    });
  } catch (err) {
    console.error('Error tracking registration:', err);
    res.status(500).json({ error: 'Failed to track registration details' });
  }
});

// 2.5. All Registrations Across ALL Campaigns (Admin) — Global Entries View
// Supports: campaign_id, status, gender, disease, date_from, date_to, search, page, limit
router.get('/all', authMiddleware, async (req, res) => {
  const { campaign_id, status, gender, disease, date_from, date_to, search, page, limit } = req.query;
  const pageNum  = parseInt(page)  || 1;
  const limitNum = parseInt(limit) || 10;
  const offset   = (pageNum - 1) * limitNum;

  try {
    // --- Build WHERE clause dynamically ---
    const conditions = [];
    const params     = [];

    if (campaign_id) {
      conditions.push('r.campaign_id = ?');
      params.push(campaign_id);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (date_from) {
      conditions.push('DATE(r.created_at) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(r.created_at) <= ?');
      params.push(date_to);
    }
    // Gender: search JSON submitted_data for gender field value
    if (gender) {
      conditions.push("CAST(r.submitted_data AS CHAR) LIKE ?");
      params.push(`%"${gender}"%`);
    }
    // Disease: fuzzy search inside JSON submitted_data
    if (disease) {
      conditions.push("CAST(r.submitted_data AS CHAR) LIKE ?");
      params.push(`%${disease}%`);
    }
    // Free-text search on reg ID or any submitted data
    if (search) {
      conditions.push('(r.registration_id LIKE ? OR CAST(r.submitted_data AS CHAR) LIKE ? OR c.title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count query
    const countSQL = `
      SELECT COUNT(*) AS total
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      ${whereClause}
    `;
    // Data query
    const dataSQL = `
      SELECT r.id, r.registration_id, r.status, r.created_at, r.submitted_data,
             c.id AS campaign_id, c.title AS campaign_title, c.category AS campaign_category,
             c.start_date, c.end_date
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [[countRow]] = await pool.query(countSQL, params);
    const [rows]       = await pool.query(dataSQL, [...params, limitNum, offset]);

    const registrations = rows.map(r => ({
      ...r,
      submitted_data: typeof r.submitted_data === 'string' ? JSON.parse(r.submitted_data) : r.submitted_data
    }));

    // Fetch all campaigns for the filter dropdown
    const [campaigns] = await pool.query(
      'SELECT id, title, category FROM campaigns ORDER BY title ASC'
    );

    // Collect disease options from FIELD DEFINITIONS (campaign_fields table)
    // so all configured options appear in the dropdown — not just submitted ones.
    const [diseaseFields] = await pool.query(
      "SELECT options FROM campaign_fields WHERE label REGEXP 'disease' AND (field_type = 'Multi Select' OR field_type = 'Checkbox' OR field_type = 'Dropdown')"
    );
    const diseaseSet = new Set();
    diseaseFields.forEach(f => {
      const opts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || []);
      opts.filter(o => o && o !== 'Other').forEach(o => diseaseSet.add(o));
    });
    // Also append any custom "Other" typed values from actual submissions
    registrations.forEach(r => {
      Object.entries(r.submitted_data || {}).forEach(([key, val]) => {
        if (/disease/i.test(key)) {
          const vals = Array.isArray(val) ? val : (val ? [String(val)] : []);
          vals.filter(v => v && v !== 'Other' && !diseaseSet.has(v)).forEach(v => diseaseSet.add(v));
        }
      });
    });


    res.json({
      registrations,
      campaigns,
      diseaseValues: [...diseaseSet].sort(),
      pagination: {
        total: countRow.total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(countRow.total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching all registrations:', err);
    res.status(500).json({ error: 'Failed to fetch all registrations.' });
  }
});

// 3. View All Registrations for Campaign (Admin)
// Supports search, sorting, filtering, and returns campaign fields so the front-end can dynamically build the table headers
router.get('/campaign/:campaignId', authMiddleware, async (req, res) => {
  const { campaignId } = req.params;
  const { search, status, disease, sort_by, sort_order, page, limit } = req.query;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const offset = (pageNum - 1) * limitNum;

  try {
    // 1. Fetch Campaign fields (schema)
    const [fields] = await pool.query('SELECT * FROM campaign_fields WHERE campaign_id = ? ORDER BY sort_order ASC', [campaignId]);
    const parsedFields = fields.map(f => ({
      ...f,
      is_required: f.is_required === 1,
      validation_rules: typeof f.validation_rules === 'string' ? JSON.parse(f.validation_rules) : f.validation_rules,
      options: typeof f.options === 'string' ? JSON.parse(f.options) : f.options
    }));

    // 2. Build Query for Registrations
    let countQuery = 'SELECT COUNT(*) AS total FROM registrations WHERE campaign_id = ?';
    let dataQuery = 'SELECT * FROM registrations WHERE campaign_id = ?';
    const params = [campaignId];

    if (status) {
      countQuery += ' AND status = ?';
      dataQuery += ' AND status = ?';
      params.push(status);
    }

    if (disease) {
      countQuery += ' AND CAST(submitted_data AS CHAR) LIKE ?';
      dataQuery += ' AND CAST(submitted_data AS CHAR) LIKE ?';
      params.push(`%${disease}%`);
    }

    if (search) {
      // In MySQL, we can search inside JSON using JSON_SEARCH or LIKE on casted string
      // Let's use a LIKE search on the casted JSON or registration_id
      countQuery += ' AND (registration_id LIKE ? OR CAST(submitted_data AS CHAR) LIKE ?)';
      dataQuery += ' AND (registration_id LIKE ? OR CAST(submitted_data AS CHAR) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Add Sorting
    const allowedSortColumns = ['id', 'registration_id', 'status', 'created_at'];
    const sortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const sortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';
    dataQuery += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Add Pagination
    dataQuery += ` LIMIT ? OFFSET ?`;
    const dataParams = [...params, limitNum, offset];

    // Run queries
    const [[countResult]] = await pool.query(countQuery, params);
    const [registrations] = await pool.query(dataQuery, dataParams);

    const parsedRegistrations = registrations.map(r => ({
      ...r,
      submitted_data: typeof r.submitted_data === 'string' ? JSON.parse(r.submitted_data) : r.submitted_data
    }));

    res.json({
      fields: parsedFields,
      registrations: parsedRegistrations,
      pagination: {
        total: countResult.total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(countResult.total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'Failed to retrieve registrations' });
  }
});

// 3.5. Export All Registrations for Campaign (Admin)
router.get('/export/:campaignId', authMiddleware, async (req, res) => {
  const { campaignId } = req.params;
  try {
    const [registrations] = await pool.query(
      'SELECT * FROM registrations WHERE campaign_id = ? ORDER BY created_at DESC',
      [campaignId]
    );

    const parsedRegistrations = registrations.map(r => ({
      ...r,
      submitted_data: typeof r.submitted_data === 'string' ? JSON.parse(r.submitted_data) : r.submitted_data
    }));

    res.json(parsedRegistrations);
  } catch (err) {
    console.error('Error exporting registrations:', err);
    res.status(500).json({ error: 'Failed to export registrations' });
  }
});

// 4. View Specific Registration Details (Admin)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [regs] = await pool.query(`
      SELECT r.*, c.title AS campaign_title, c.banner_url
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      WHERE r.id = ?
    `, [id]);

    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = regs[0];
    
    // Get fields layout for parsing
    const [fields] = await pool.query('SELECT * FROM campaign_fields WHERE campaign_id = ? ORDER BY sort_order ASC', [reg.campaign_id]);
    
    const parsedFields = fields.map(f => ({
      ...f,
      is_required: f.is_required === 1,
      validation_rules: typeof f.validation_rules === 'string' ? JSON.parse(f.validation_rules) : f.validation_rules,
      options: typeof f.options === 'string' ? JSON.parse(f.options) : f.options
    }));

    // Get files uploaded for this registration
    const [files] = await pool.query('SELECT * FROM uploaded_files WHERE registration_id = ?', [id]);

    res.json({
      registration: {
        ...reg,
        submitted_data: typeof reg.submitted_data === 'string' ? JSON.parse(reg.submitted_data) : reg.submitted_data
      },
      fields: parsedFields,
      files
    });
  } catch (err) {
    console.error('Error retrieving registration details:', err);
    res.status(500).json({ error: 'Failed to retrieve registration details' });
  }
});

// 5. Update Registration Status (Admin)
router.put('/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const [regs] = await pool.query('SELECT registration_id, campaign_id FROM registrations WHERE id = ?', [id]);
    if (regs.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    await pool.query('UPDATE registrations SET status = ? WHERE id = ?', [status, id]);

    // Log Activity
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await pool.query(
      'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, req.user.email, 'Update Registration Status', `Updated status of ${regs[0].registration_id} to "${status}"`, ip]
    );

    res.json({ message: 'Registration status updated successfully' });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
});

module.exports = router;
