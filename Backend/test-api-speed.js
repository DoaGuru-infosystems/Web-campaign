const http = require('http');

const loginData = JSON.stringify({
  email: 'admin@campaignflow.com',
  password: 'adminpassword'
});

function post(path, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: 'GET',
      headers: {}
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('Logging in...');
  const loginRes = await post('/api/auth/login', loginData);
  const token = loginRes.body.token;
  console.log('Login successful.');

  console.log('\nTiming /api/analytics/dashboard...');
  const t1 = Date.now();
  const dRes = await get('/api/analytics/dashboard', token);
  console.log(`/api/analytics/dashboard responded in ${Date.now() - t1}ms with status ${dRes.status}`);

  console.log('\nTiming /api/analytics/charts...');
  const t2 = Date.now();
  const cRes = await get('/api/analytics/charts', token);
  console.log(`/api/analytics/charts responded in ${Date.now() - t2}ms with status ${cRes.status}`);
}

run();
