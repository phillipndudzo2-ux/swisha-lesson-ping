const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const vapidKeys = webpush.generateVAPIDKeys();

const envContent = `VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:you@school.edu
PORT=3000
`;

fs.writeFileSync(path.join(__dirname, '..', '.env'), envContent);

console.log('✅ VAPID keys generated and saved to .env');
console.log('Public key:', vapidKeys.publicKey);
console.log('\nYou can now start the server with: npm start');
