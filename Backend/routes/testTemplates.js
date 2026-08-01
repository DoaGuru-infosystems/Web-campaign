const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('./auth');

// 1. Get all templates (accessible by both Admin and Employee)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM test_templates ORDER BY id DESC');
    const templates = rows.map(r => ({
      ...r,
      vitals: typeof r.vitals === 'string' ? JSON.parse(r.vitals) : r.vitals,
      questions: typeof r.questions === 'string' ? JSON.parse(r.questions) : r.questions,
    }));
    res.json({ templates });
  } catch (err) {
    console.error('Error fetching test templates:', err);
    res.status(500).json({ error: 'Failed to retrieve test templates' });
  }
});

// 2. Create/Save a template (Admin Only)
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only administrators can perform this action.' });
  }

  const { title, vitals, questions } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO test_templates (title, vitals, questions) VALUES (?, ?, ?)',
      [title, JSON.stringify(vitals || []), JSON.stringify(questions || [])]
    );
    res.status(201).json({ message: 'Test template created successfully', id: result.insertId });
  } catch (err) {
    console.error('Error creating test template:', err);
    res.status(500).json({ error: 'Failed to create test template' });
  }
});

// 3. Delete a template (Admin Only)
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only administrators can perform this action.' });
  }

  const { id } = req.params;
  try {
    await pool.query('DELETE FROM test_templates WHERE id = ?', [id]);
    res.json({ message: 'Test template deleted successfully' });
  } catch (err) {
    console.error('Error deleting test template:', err);
    res.status(500).json({ error: 'Failed to delete test template' });
  }
});

// 4. Update a template (Admin Only)
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only administrators can perform this action.' });
  }

  const { id } = req.params;
  const { title, vitals, questions } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE test_templates SET title = ?, vitals = ?, questions = ? WHERE id = ?',
      [title, JSON.stringify(vitals || []), JSON.stringify(questions || []), id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Test template not found' });
    }
    res.json({ message: 'Test template updated successfully' });
  } catch (err) {
    console.error('Error updating test template:', err);
    res.status(500).json({ error: 'Failed to update test template' });
  }
});

module.exports = router;
