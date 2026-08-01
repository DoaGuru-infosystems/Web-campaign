const { pool } = require('../db');

async function testEndpointLogic() {
  const registrationId = 'CMP-2026-0015';
  try {
    const [regs] = await pool.query(
      'SELECT id FROM registrations WHERE registration_id = ? OR id = ?',
      [registrationId, registrationId]
    );

    if (regs.length === 0) {
      console.log('Registration not found');
      return;
    }

    const regDbId = regs[0].id;
    console.log('Resolved regDbId:', regDbId);

    const [tests] = await pool.query(
      'SELECT * FROM patient_tests WHERE registration_id = ?',
      [regDbId]
    );

    if (tests.length === 0) {
      console.log('No tests found');
      return;
    }

    const test = tests[0];
    const parsed = {
      test: {
        ...test,
        vitals_data: typeof test.vitals_data === 'string' ? JSON.parse(test.vitals_data) : test.vitals_data,
        test_data: typeof test.test_data === 'string' ? JSON.parse(test.test_data) : test.test_data,
      }
    };
    console.log('PARSED RESPONSE:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testEndpointLogic();
