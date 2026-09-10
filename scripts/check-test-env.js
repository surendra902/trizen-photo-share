const fs = require('fs');
if (!fs.existsSync('.env.test')) {
  console.error(
    'Missing .env.test — copy .env.test.example to .env.test and set DATABASE_URL ' +
    'to a throwaway test database (never your demo/production DB; tests wipe it).'
  );
  process.exit(1);
}
