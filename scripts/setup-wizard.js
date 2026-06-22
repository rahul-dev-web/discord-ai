/**
 * SETUP WIZARD
 * Interactive first-time setup for the bot
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function runSetup() {
  console.log('\n🚀 IGL DISCORD BOT SETUP WIZARD\n');
  console.log('This wizard will help you configure the bot.\n');

  const config = {};

  // Discord Token
  console.log('📱 DISCORD BOT TOKEN');
  console.log('Get it from: https://discord.com/developers/applications\n');
  config.DISCORD_TOKEN = await question('Enter your Discord bot token: ');

  // Firebase Configuration
  console.log('\n🔥 FIREBASE CONFIGURATION');
  console.log('Get these from your Firebase project settings.\n');
  config.FIREBASE_API_KEY = await question('Firebase API Key: ');
  config.FIREBASE_AUTH_DOMAIN = await question('Firebase Auth Domain: ');
  config.FIREBASE_DATABASE_URL = await question('Firebase Database URL: ');
  config.FIREBASE_PROJECT_ID = await question('Firebase Project ID: ');
  config.FIREBASE_STORAGE_BUCKET = await question('Firebase Storage Bucket: ');
  config.FIREBASE_MESSAGING_SENDER_ID = await question('Firebase Messaging Sender ID: ');
  config.FIREBASE_APP_ID = await question('Firebase App ID: ');

  // Groq API Key
  console.log('\n🧠 GROQ API CONFIGURATION');
  console.log('Get it from: https://console.groq.com/keys\n');
  config.GROQ_API_KEY = await question('Enter your Groq API key: ');

  // Security Salt
  console.log('\n🔐 SECURITY CONFIGURATION\n');
  const randomSalt = require('crypto').randomBytes(32).toString('hex');
  config.SECURITY_SALT = randomSalt;
  console.log(`Generated security salt: ${randomSalt.substring(0, 20)}...`);

  // Create .env file
  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(path.join(__dirname, '../.env'), envContent);
  console.log('\n✅ Created .env file successfully!\n');

  // Verify setup
  console.log('📋 SETUP SUMMARY:');
  console.log(`✓ Discord Token: ${config.DISCORD_TOKEN.substring(0, 10)}...`);
  console.log(`✓ Firebase Project: ${config.FIREBASE_PROJECT_ID}`);
  console.log(`✓ Groq API Key: ${config.GROQ_API_KEY.substring(0, 10)}...`);
  console.log(`✓ Security Salt: ${config.SECURITY_SALT.substring(0, 20)}...\n`);

  console.log('🎉 Setup complete! You can now run: npm start\n');

  rl.close();
}

runSetup().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});
