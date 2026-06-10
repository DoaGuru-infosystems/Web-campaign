const mysql = require('mysql2/promise');
require('dotenv').config();

async function test(host) {
  const start = Date.now();
  try {
    const connection = await mysql.createConnection({
      host: host,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Meer@9893676520',
      database: process.env.DB_NAME || 'doctor_camp',
    });
    const [rows] = await connection.query('SELECT 1');
    await connection.end();
    console.log(`Connection to ${host} succeeded in ${Date.now() - start}ms`);
  } catch (err) {
    console.log(`Connection to ${host} failed in ${Date.now() - start}ms: ${err.message}`);
  }
}

async function run() {
  console.log('Testing localhost...');
  await test('localhost');
  console.log('Testing 127.0.0.1...');
  await test('127.0.0.1');
}

run();
