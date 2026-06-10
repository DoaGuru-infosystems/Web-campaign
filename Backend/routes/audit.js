const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

// Fetch Audit Logs (Admin)
router.get('/', authMiddleware, async (req, res) => {
  const { search, page, limit } = req.query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const offset = (pageNum - 1) * limitNum;

  try {
    let countQuery = 'SELECT COUNT(*) AS total FROM audit_logs';
    let dataQuery = 'SELECT * FROM audit_logs';
    const params = [];

    if (search) {
      const searchWild = `%${search}%`;
      countQuery += ' WHERE action LIKE ? OR user_email LIKE ? OR details LIKE ?';
      dataQuery += ' WHERE action LIKE ? OR user_email LIKE ? OR details LIKE ?';
      params.push(searchWild, searchWild, searchWild);
    }

    dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, limitNum, offset];

    const [[countResult]] = await pool.query(countQuery, params);
    const [logs] = await pool.query(dataQuery, dataParams);

    res.json({
      logs,
      pagination: {
        total: countResult.total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(countResult.total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

module.exports = router;
