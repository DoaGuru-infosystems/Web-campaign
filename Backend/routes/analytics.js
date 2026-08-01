const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

// 1. Dashboard Global Stats
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Total Campaigns
    const [[{ total_campaigns }]] = await pool.query('SELECT COUNT(*) AS total_campaigns FROM campaigns');

    // Active Campaigns (status = 'Published' and end_date >= today)
    const [[{ active_campaigns }]] = await pool.query(
      "SELECT COUNT(*) AS active_campaigns FROM campaigns WHERE status = 'Published' AND end_date >= ?",
      [today]
    );

    // Total Registrations
    const [[{ total_registrations }]] = await pool.query('SELECT COUNT(*) AS total_registrations FROM registrations');

    // Registrations Today
    const [[{ registrations_today }]] = await pool.query(
      'SELECT COUNT(*) AS registrations_today FROM registrations WHERE DATE(created_at) = ?',
      [today]
    );

    // Recent Campaigns (last 5)
    const [recentCampaigns] = await pool.query(`
      SELECT c.*, COUNT(r.id) AS registrations_count
      FROM campaigns c
      LEFT JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    // Recent Participants (last 5)
    const [recentParticipants] = await pool.query(`
      SELECT r.id, r.registration_id, r.created_at, r.status, r.submitted_data, c.title AS campaign_title
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 5
    `);

    // Parse submitted_data for participants to extract basic fields like name/email
    const parsedParticipants = recentParticipants.map(rp => {
      let dataObj = {};
      try {
        dataObj = typeof rp.submitted_data === 'string' ? JSON.parse(rp.submitted_data) : (rp.submitted_data || {});
      } catch (e) {}
      if (!dataObj || typeof dataObj !== 'object') {
        dataObj = {};
      }
      
      // Try to find a name or email field dynamically
      let name = 'Participant';
      let contact = '';
      
      for (const [key, val] of Object.entries(dataObj)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('name') && typeof val === 'string' && name === 'Participant') {
          name = val;
        }
        if ((lowerKey.includes('email') || lowerKey.includes('phone')) && typeof val === 'string' && !contact) {
          contact = val;
        }
      }

      return {
        id: rp.id,
        registration_id: rp.registration_id,
        campaign_title: rp.campaign_title,
        created_at: rp.created_at,
        status: rp.status,
        name,
        contact
      };
    });

    res.json({
      stats: {
        total_campaigns,
        active_campaigns,
        total_registrations,
        registrations_today
      },
      recent_campaigns: recentCampaigns,
      recent_participants: parsedParticipants
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

// 2. Charts Data
router.get('/charts', authMiddleware, async (req, res) => {
  try {
    // Campaign-wise registrations
    const [campaignWise] = await pool.query(`
      SELECT c.title AS campaign_title, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.id
      ORDER BY value DESC
      LIMIT 10
    `);

    // Daily registrations (last 14 days)
    const [dailyRegs] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM registrations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `);

    // Monthly registrations growth (current year)
    const [monthlyGrowth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%b') AS month, COUNT(*) AS count
      FROM registrations
      WHERE YEAR(created_at) = YEAR(NOW())
      GROUP BY MONTH(created_at), DATE_FORMAT(created_at, '%b')
      ORDER BY MONTH(created_at) ASC
    `);

    // Category-wise performance
    const [categoryWise] = await pool.query(`
      SELECT c.category AS name, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.category
      ORDER BY value DESC
    `);

    res.json({
      campaign_wise: campaignWise,
      daily: dailyRegs,
      monthly: monthlyGrowth,
      category_wise: categoryWise
    });
  } catch (err) {
    console.error('Error fetching chart data:', err);
    res.status(500).json({ error: 'Failed to retrieve charts analytics' });
  }
});

// 3. Notifications List
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

// 4. Mark notifications read
router.post('/notifications/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1');
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking notifications read:', err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

module.exports = router;
