const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

// Helper to log audit activities
async function logActivity(req, action, details) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userId = req.user ? req.user.id : null;
    const userEmail = req.user ? req.user.email : 'System';
    await pool.query(
      'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, userEmail, action, details, ip]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// 1. Create Campaign
router.post('/', authMiddleware, async (req, res) => {
  const {
    title,
    description,
    banner_url,
    start_date,
    end_date,
    category,
    status,
    submission_limit,
    thank_you_message,
    registration_id_prefix,
    fields // array of field configurations
  } = req.body;

  if (!title || !start_date || !end_date || !category) {
    return res.status(400).json({ error: 'Title, start/end dates, and category are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Insert campaign
    const [campResult] = await conn.query(`
      INSERT INTO campaigns (
        title, description, banner_url, start_date, end_date, 
        category, status, submission_limit, thank_you_message, registration_id_prefix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title, 
      description || '', 
      banner_url || null, 
      start_date, 
      end_date, 
      category, 
      status || 'Draft', 
      submission_limit ? parseInt(submission_limit) : null, 
      thank_you_message || 'Thank you for your submission!',
      registration_id_prefix || 'CMP-2026'
    ]);

    const campaignId = campResult.insertId;

    // Insert fields
    if (fields && Array.isArray(fields) && fields.length > 0) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await conn.query(`
          INSERT INTO campaign_fields (
            campaign_id, field_name, label, field_type, placeholder, 
            description, is_required, validation_rules, options, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          campaignId,
          f.field_name || `field_${i}`,
          f.label || 'Field',
          f.field_type || 'Single Line Text',
          f.placeholder || null,
          f.description || null,
          f.is_required ? 1 : 0,
          JSON.stringify(f.validation_rules || {}),
          JSON.stringify(f.options || []),
          f.sort_order || i
        ]);
      }
    }

    // Add general notification
    await conn.query(`
      INSERT INTO notifications (type, message) 
      VALUES ('Campaign Published', ?)
    `, [`A new campaign "${title}" has been successfully created as ${status || 'Draft'}.`]);

    await conn.commit();
    
    // Log audit
    await logActivity(req, 'Create Campaign', `Created campaign "${title}" (ID: ${campaignId})`);

    res.status(201).json({ message: 'Campaign created successfully', campaignId });
  } catch (err) {
    await conn.rollback();
    console.error('Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  } finally {
    conn.release();
  }
});

// 2. View All Campaigns (Admin)
router.get('/', authMiddleware, async (req, res) => {
  const { search, category, status } = req.query;
  let query = `
    SELECT c.*, COUNT(r.id) AS total_registrations 
    FROM campaigns c 
    LEFT JOIN registrations r ON c.id = r.campaign_id
  `;
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push(`(c.title LIKE ? OR c.description LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push(`c.category = ?`);
    params.push(category);
  }
  if (status) {
    conditions.push(`c.status = ?`);
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }

  query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

  try {
    const [campaigns] = await pool.query(query, params);
    res.json({ campaigns });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to retrieve campaigns' });
  }
});

// 3. View Public Campaigns (No Login required for listing active campaigns if needed, or viewing individual public campaign)
router.get('/public/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Get campaign details
    const [camps] = await pool.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (camps.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = camps[0];

    // Check status and expiry
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(campaign.end_date).toISOString().split('T')[0];
    const isClosed = campaign.status === 'Closed' || endDate < today;

    // Get fields
    const [fields] = await pool.query('SELECT * FROM campaign_fields WHERE campaign_id = ? ORDER BY sort_order ASC', [id]);

    // Parse json
    const parsedFields = fields.map(f => ({
      ...f,
      is_required: f.is_required === 1,
      validation_rules: typeof f.validation_rules === 'string' ? JSON.parse(f.validation_rules) : f.validation_rules,
      options: typeof f.options === 'string' ? JSON.parse(f.options) : f.options
    }));

    res.json({
      campaign: {
        ...campaign,
        isClosed
      },
      fields: parsedFields
    });
  } catch (err) {
    console.error('Error retrieving public campaign:', err);
    res.status(500).json({ error: 'Failed to retrieve campaign details' });
  }
});

// 4. View Single Campaign (Admin - Details & Config)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const [camps] = await pool.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (camps.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const [fields] = await pool.query('SELECT * FROM campaign_fields WHERE campaign_id = ? ORDER BY sort_order ASC', [id]);

    const parsedFields = fields.map(f => ({
      ...f,
      is_required: f.is_required === 1,
      validation_rules: typeof f.validation_rules === 'string' ? JSON.parse(f.validation_rules) : f.validation_rules,
      options: typeof f.options === 'string' ? JSON.parse(f.options) : f.options
    }));

    res.json({
      campaign: camps[0],
      fields: parsedFields
    });
  } catch (err) {
    console.error('Error fetching campaign:', err);
    res.status(500).json({ error: 'Failed to retrieve campaign' });
  }
});

// 5. Update Campaign (Admin)
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    banner_url,
    start_date,
    end_date,
    category,
    status,
    submission_limit,
    thank_you_message,
    registration_id_prefix,
    fields
  } = req.body;

  if (!title || !start_date || !end_date || !category) {
    return res.status(400).json({ error: 'Title, dates, and category are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Update campaign table
    await conn.query(`
      UPDATE campaigns 
      SET title = ?, description = ?, banner_url = ?, start_date = ?, 
          end_date = ?, category = ?, status = ?, submission_limit = ?, 
          thank_you_message = ?, registration_id_prefix = ?
      WHERE id = ?
    `, [
      title, description || '', banner_url || null, start_date, 
      end_date, category, status || 'Draft', 
      submission_limit ? parseInt(submission_limit) : null,
      thank_you_message || 'Thank you for your submission!',
      registration_id_prefix || 'CMP-2026',
      id
    ]);

    // Delete old fields
    await conn.query('DELETE FROM campaign_fields WHERE campaign_id = ?', [id]);

    // Insert new fields
    if (fields && Array.isArray(fields) && fields.length > 0) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await conn.query(`
          INSERT INTO campaign_fields (
            campaign_id, field_name, label, field_type, placeholder, 
            description, is_required, validation_rules, options, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          f.field_name || `field_${i}`,
          f.label || 'Field',
          f.field_type || 'Single Line Text',
          f.placeholder || null,
          f.description || null,
          f.is_required ? 1 : 0,
          JSON.stringify(f.validation_rules || {}),
          JSON.stringify(f.options || []),
          f.sort_order || i
        ]);
      }
    }

    await conn.commit();

    await logActivity(req, 'Update Campaign', `Updated campaign "${title}" (ID: ${id})`);

    res.json({ message: 'Campaign updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Error updating campaign:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  } finally {
    conn.release();
  }
});

// 6. Delete Campaign (Admin)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // Get title first for audit log
    const [camps] = await pool.query('SELECT title FROM campaigns WHERE id = ?', [id]);
    if (camps.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const title = camps[0].title;
    
    // Delete campaign (Foreign Keys handle fields and registrations delete)
    await pool.query('DELETE FROM campaigns WHERE id = ?', [id]);

    await logActivity(req, 'Delete Campaign', `Deleted campaign "${title}" (ID: ${id})`);

    res.json({ message: 'Campaign and all associated data deleted successfully' });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// 7. Duplicate Campaign (Admin)
router.post('/:id/duplicate', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch existing
    const [camps] = await conn.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    if (camps.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const camp = camps[0];

    // Create duplicate campaign row
    const [dupResult] = await conn.query(`
      INSERT INTO campaigns (
        title, description, banner_url, start_date, end_date, 
        category, status, submission_limit, thank_you_message, registration_id_prefix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `${camp.title} (Copy)`,
      camp.description,
      camp.banner_url,
      camp.start_date,
      camp.end_date,
      camp.category,
      'Draft', // Always duplicate as Draft
      camp.submission_limit,
      camp.thank_you_message,
      camp.registration_id_prefix
    ]);

    const newCampaignId = dupResult.insertId;

    // Fetch existing fields
    const [fields] = await conn.query('SELECT * FROM campaign_fields WHERE campaign_id = ? ORDER BY sort_order ASC', [id]);
    
    for (let f of fields) {
      await conn.query(`
        INSERT INTO campaign_fields (
          campaign_id, field_name, label, field_type, placeholder, 
          description, is_required, validation_rules, options, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newCampaignId,
        f.field_name,
        f.label,
        f.field_type,
        f.placeholder,
        f.description,
        f.is_required,
        f.validation_rules, // Already JSON string
        f.options, // Already JSON string
        f.sort_order
      ]);
    }

    await conn.commit();

    await logActivity(req, 'Duplicate Campaign', `Duplicated campaign "${camp.title}" (ID: ${id}) to new draft (ID: ${newCampaignId})`);

    res.status(201).json({ message: 'Campaign duplicated successfully', campaignId: newCampaignId });
  } catch (err) {
    await conn.rollback();
    console.error('Error duplicating campaign:', err);
    res.status(500).json({ error: 'Failed to duplicate campaign' });
  } finally {
    conn.release();
  }
});

module.exports = router;
