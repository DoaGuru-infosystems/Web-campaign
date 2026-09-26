const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "camp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDB() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log(
      "Connected to MySQL database: " + (process.env.DB_NAME || "doctor_camp"),
    );

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
        assigned_employee_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // Check and add assigned_employee_id to campaigns if not exists (for existing databases)
    const [campaignCols] = await connection.query(
      `SHOW COLUMNS FROM campaigns LIKE 'assigned_employee_id'`,
    );
    if (campaignCols.length === 0) {
      await connection
        .query(
          `
        ALTER TABLE campaigns 
        ADD COLUMN assigned_employee_id INT DEFAULT NULL,
        ADD FOREIGN KEY (campaigns_ibfk_assigned_employee) REFERENCES users(id) ON DELETE SET NULL
      `,
        )
        .catch(async () => {
          // Fallback in case foreign key naming syntax varies
          await connection.query(`
          ALTER TABLE campaigns 
          ADD COLUMN assigned_employee_id INT DEFAULT NULL,
          ADD FOREIGN KEY (assigned_employee_id) REFERENCES users(id) ON DELETE SET NULL
        `);
        });
      console.log("Added assigned_employee_id column to campaigns table.");
    }

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

    // 9. Test Templates Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        vitals JSON DEFAULT NULL,
        questions JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 10. Patient Tests Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS patient_tests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id INT NOT NULL,
        vitals_data JSON DEFAULT NULL,
        test_data JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Check and create index on registrations(created_at) for pagination / listing order speedup
    try {
      const [indexes] = await connection.query(
        "SHOW INDEX FROM registrations WHERE Key_name = 'idx_registrations_created_at'",
      );
      if (indexes.length === 0) {
        await connection.query(
          "ALTER TABLE registrations ADD INDEX idx_registrations_created_at (created_at)",
        );
        console.log(
          "Created index idx_registrations_created_at on registrations table.",
        );
      }
    } catch (idxErr) {
      console.error("Failed to create index on registrations:", idxErr);
    }

    // Check and create composite index on campaigns(status, end_date) for active campaigns dashboard metrics query
    try {
      const [indexes] = await connection.query(
        "SHOW INDEX FROM campaigns WHERE Key_name = 'idx_campaigns_status_end_date'",
      );
      if (indexes.length === 0) {
        await connection.query(
          "ALTER TABLE campaigns ADD INDEX idx_campaigns_status_end_date (status, end_date)",
        );
        console.log(
          "Created index idx_campaigns_status_end_date on campaigns table.",
        );
      }
    } catch (idxErr) {
      console.error("Failed to create index on campaigns:", idxErr);
    }

    // Check and add test_template_id to campaigns if not exists
    try {
      const [campaignTestCols] = await connection.query(
        "SHOW COLUMNS FROM campaigns LIKE 'test_template_id'",
      );
      if (campaignTestCols.length === 0) {
        await connection.query(`
          ALTER TABLE campaigns 
          ADD COLUMN test_template_id INT DEFAULT NULL,
          ADD FOREIGN KEY (test_template_id) REFERENCES test_templates(id) ON DELETE SET NULL
        `);
        console.log("Added test_template_id column to campaigns table.");
      }
    } catch (colErr) {
      console.error("Failed to add test_template_id column:", colErr);
    }

    // Check and add refer_to_hospital and travelling_by to patient_tests if not exists
    try {
      const [referCols] = await connection.query(
        "SHOW COLUMNS FROM patient_tests LIKE 'refer_to_hospital'",
      );
      if (referCols.length === 0) {
        await connection.query(`
          ALTER TABLE patient_tests 
          ADD COLUMN refer_to_hospital VARCHAR(50) DEFAULT 'No'
        `);
        console.log("Added refer_to_hospital column to patient_tests table.");
      }

      const [travelCols] = await connection.query(
        "SHOW COLUMNS FROM patient_tests LIKE 'travelling_by'",
      );
      if (travelCols.length === 0) {
        await connection.query(`
          ALTER TABLE patient_tests 
          ADD COLUMN travelling_by VARCHAR(255) DEFAULT 'None'
        `);
        console.log("Added travelling_by column to patient_tests table.");
      }
    } catch (colErr) {
      console.error(
        "Failed to add referral/travel columns to patient_tests:",
        colErr,
      );
    }

    // 8. Campaign Assignments Table (Multi-employee mapping)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS campaign_assignments (
        campaign_id INT NOT NULL,
        user_id INT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (campaign_id, user_id),
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Migrate existing single assignment data (assigned_employee_id) if the campaigns table has it
    try {
      const [cols] = await connection.query(
        "SHOW COLUMNS FROM campaigns LIKE 'assigned_employee_id'",
      );
      if (cols.length > 0) {
        await connection.query(`
          INSERT IGNORE INTO campaign_assignments (campaign_id, user_id)
          SELECT id, assigned_employee_id FROM campaigns 
          WHERE assigned_employee_id IS NOT NULL
        `);
      }
    } catch (migErr) {
      console.error("Migration of campaign_assignments warning:", migErr);
    }

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
    const [users] = await connection.query("SELECT * FROM users LIMIT 1");
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash("adminpassword", 10);
      await connection.query(
        `
        INSERT INTO users (name, email, password, role) 
        VALUES ('System Administrator', 'admin@campaignflow.com', ?, 'Admin')
      `,
        [hashedPassword],
      );
      console.log(
        "Seeded default administrator: admin@campaignflow.com / adminpassword",
      );
    }

    console.log("Database tables verified/created successfully.");
  } catch (err) {
    console.error("Error initializing database tables:", err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  pool,
  initDB,
};
