const { pool } = require('./db');

async function check() {
  console.log('Starting query profiling...');
  const today = new Date().toISOString().split('T')[0];

  const queries = [
    { name: 'Total Campaigns', sql: 'SELECT COUNT(*) AS total_campaigns FROM campaigns' },
    { name: 'Active Campaigns', sql: "SELECT COUNT(*) AS active_campaigns FROM campaigns WHERE status = 'Published' AND end_date >= ?", params: [today] },
    { name: 'Total Registrations', sql: 'SELECT COUNT(*) AS total_registrations FROM registrations' },
    { name: 'Registrations Today', sql: 'SELECT COUNT(*) AS registrations_today FROM registrations WHERE DATE(created_at) = ?', params: [today] },
    { name: 'Recent Campaigns', sql: `
      SELECT c.*, COUNT(r.id) AS registrations_count
      FROM campaigns c
      LEFT JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 5
    ` },
    { name: 'Recent Participants', sql: `
      SELECT r.id, r.registration_id, r.created_at, r.status, r.submitted_data, c.title AS campaign_title
      FROM registrations r
      JOIN campaigns c ON r.campaign_id = c.id
      ORDER BY r.created_at DESC
      LIMIT 5
    ` }
  ];

  for (const q of queries) {
    const start = Date.now();
    try {
      await pool.query(q.sql, q.params || []);
      console.log(`${q.name} took ${Date.now() - start}ms`);
    } catch (e) {
      console.error(`${q.name} failed:`, e.message);
    }
  }

  const chartQueries = [
    { name: 'Campaign-wise', sql: `
      SELECT c.title AS campaign_title, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.id
      ORDER BY value DESC
      LIMIT 10
    ` },
    { name: 'Daily', sql: `
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM registrations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    ` },
    { name: 'Monthly', sql: `
      SELECT DATE_FORMAT(created_at, '%b') AS month, COUNT(*) AS count
      FROM registrations
      WHERE YEAR(created_at) = YEAR(NOW())
      GROUP BY MONTH(created_at), DATE_FORMAT(created_at, '%b')
      ORDER BY MONTH(created_at) ASC
    ` },
    { name: 'Category-wise', sql: `
      SELECT c.category AS name, COUNT(r.id) AS value
      FROM campaigns c
      JOIN registrations r ON c.id = r.campaign_id
      GROUP BY c.category
      ORDER BY value DESC
    ` }
  ];

  for (const q of chartQueries) {
    const start = Date.now();
    try {
      await pool.query(q.sql);
      console.log(`Chart - ${q.name} took ${Date.now() - start}ms`);
    } catch (e) {
      console.error(`Chart - ${q.name} failed:`, e.message);
    }
  }

  await pool.end();
}

check();
