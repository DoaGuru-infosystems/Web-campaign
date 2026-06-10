const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Meer@9893676520',
  database: process.env.DB_NAME || 'doctor_camp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDB() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Connected to MySQL database: ' + (process.env.DB_NAME || 'doctor_camp'));

    // 1. Users Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'Admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Campaigns Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        banner_url VARCHAR(500) DEFAULT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        category VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Draft',
        submission_limit INT DEFAULT NULL,
        thank_you_message TEXT DEFAULT NULL,
        registration_id_prefix VARCHAR(50) DEFAULT 'CMP-2026',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 3. Campaign Fields Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_fields (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        label VARCHAR(255) NOT NULL,
        field_type VARCHAR(100) NOT NULL,
        placeholder VARCHAR(255) DEFAULT NULL,
        description VARCHAR(500) DEFAULT NULL,
        is_required TINYINT(1) DEFAULT 0,
        validation_rules JSON DEFAULT NULL,
        options JSON DEFAULT NULL,
        sort_order INT DEFAULT 0,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 4. Registrations Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        campaign_id INT NOT NULL,
        registration_id VARCHAR(100) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        submitted_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 5. Uploaded Files Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id INT DEFAULT NULL,
        campaign_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 6. Notifications Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        message VARCHAR(500) NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 7. Audit Logs Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_email VARCHAR(255) DEFAULT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT DEFAULT NULL,
        ip_address VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Seed default Admin user if none exists
    const [users] = await connection.query('SELECT * FROM users LIMIT 1');
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      await connection.query(`
        INSERT INTO users (name, email, password, role) 
        VALUES ('System Administrator', 'admin@campaignflow.com', ?, 'Admin')
      `, [hashedPassword]);
      console.log('Seeded default administrator: admin@campaignflow.com / adminpassword');
    }

    console.log('Database tables verified/created successfully.');
  } catch (err) {
    console.error('Error initializing database tables:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  pool,
  initDB,
};
