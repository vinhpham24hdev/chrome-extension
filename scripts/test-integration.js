#!/usr/bin/env node

// Integration test script for frontend + backend
const fs = require('fs');
const path = require('path');

async function testIntegration() {
  console.log('🧪 Testing Frontend + Backend Integration\n');

  // Check environment configuration
  console.log('1️⃣ Checking environment configuration...');
  
  const envFile = '.env.development';
  if (!fs.existsSync(envFile)) {
    console.error('❌ .env.development file not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envFile, 'utf8');
  const apiBaseUrl = envContent.match(/VITE_API_BASE_URL=(.+)/)?.[1];
  const mockMode = envContent.match(/VITE_ENABLE_MOCK_MODE=(.+)/)?.[1];

  console.log(`   API Base URL: ${apiBaseUrl || 'NOT SET'}`);
  console.log(`   Mock Mode: ${mockMode || 'NOT SET'}`);

  if (!apiBaseUrl) {
    console.error('❌ VITE_API_BASE_URL not configured');
    process.exit(1);
  }

  // Test backend connectivity
  console.log('\n2️⃣ Testing backend connectivity...');
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${apiBaseUrl}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is reachable');
      console.log(`   Status: ${data.status}`);
      console.log(`   SDK Version: ${data.sdkVersion || 'unknown'}`);
    } else {
      console.error(`❌ Backend health check failed: ${response.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Cannot reach backend: ${error.message}`);
    console.log('\n💡 Make sure backend is running:');
    console.log('   cd chrome-screen-capture-api');
    console.log('   npm run dev');
    process.exit(1);
  }

  // Test authentication
  console.log('\n3️⃣ Testing authentication...');
  
  try {
    const fetch = (await import('node-fetch')).default;
    const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo', password: 'password' })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Authentication working');
      console.log(`   User: ${loginData.user.username}`);
      
      // Test cases endpoint
      console.log('\n4️⃣ Testing cases endpoint...');
      const casesResponse = await fetch(`${apiBaseUrl}/cases`, {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });

      if (casesResponse.ok) {
        const casesData = await casesResponse.json();
        console.log('✅ Cases endpoint working');
        console.log(`   Cases found: ${casesData.cases?.length || 0}`);
      } else {
        console.error('❌ Cases endpoint failed');
        process.exit(1);
      }

      // Test upload endpoint
      console.log('\n5️⃣ Testing upload endpoint...');
      const uploadResponse = await fetch(`${apiBaseUrl}/upload/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({
          fileName: 'test.png',
          fileType: 'image/png',
          caseId: 'CASE-001',
          captureType: 'screenshot'
        })
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('✅ Upload endpoint working');
        console.log(`   Upload URL generated: ${uploadData.uploadUrl ? 'Yes' : 'No'}`);
      } else {
        console.error('❌ Upload endpoint failed');
        process.exit(1);
      }

    } else {
      console.error('❌ Authentication failed');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Authentication test failed: ${error.message}`);
    process.exit(1);
  }

  console.log('\n🎉 All integration tests passed!');
  console.log('\n📋 Integration Status:');
  console.log('   ✅ Environment configured');
  console.log('   ✅ Backend connectivity');
  console.log('   ✅ Authentication flow');
  console.log('   ✅ Cases management');
  console.log('   ✅ File upload');
  console.log('\n🚀 Ready for frontend development!');
}

testIntegration().catch(error => {
  console.error('💥 Integration test failed:', error.message);
  process.exit(1);
});
