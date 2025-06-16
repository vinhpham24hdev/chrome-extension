
// scripts/check-config.js - Configuration Checker Script
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking AWS Configuration...\n');

// Check functions
function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.development');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.development file not found');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'AWS_S3_BUCKET_NAME',
    'AWS_REGION', 
    'API_BASE_URL',
    'MAX_FILE_SIZE',
    'ENABLE_MOCK_MODE'
  ];
  
  const missingVars = requiredVars.filter(varName => !envContent.includes(varName));
  
  if (missingVars.length > 0) {
    console.log('❌ Missing environment variables:', missingVars.join(', '));
    return false;
  }
  
  console.log('✅ Environment configuration looks good');
  return true;
}

async function checkAPIHealth() {
  const envPath = path.join(process.cwd(), '.env.development');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Cannot check API - .env file missing');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiUrlMatch = envContent.match(/API_BASE_URL=(.+)/);
  
  if (!apiUrlMatch) {
    console.log('❌ API_BASE_URL not found in .env');
    return false;
  }
  
  const apiUrl = apiUrlMatch[1].trim();
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${apiUrl}/health`, {
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('✅ API health check passed');
      return true;
    } else {
      console.log(`❌ API health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ API not reachable: ${error.message}`);
    console.log('💡 This is expected if backend is not running or in mock mode');
    return false;
  }
}

async function checkS3Bucket() {
  const envPath = path.join(process.cwd(), '.env.development');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Cannot check S3 - .env file missing');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const bucketMatch = envContent.match(/AWS_S3_BUCKET_NAME=(.+)/);
  const regionMatch = envContent.match(/AWS_REGION=(.+)/);
  
  if (!bucketMatch || !regionMatch) {
    console.log('❌ S3 configuration incomplete');
    return false;
  }
  
  const bucketName = bucketMatch[1].trim();
  const region = regionMatch[1].trim();
  
  try {
    // Simple check - try to access bucket URL
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://${bucketName}.s3.${region}.amazonaws.com/`, {
      method: 'HEAD',
      timeout: 5000
    });
    
    // Bucket exists if we get any response (even 403 is fine)
    if (response.status === 200 || response.status === 403) {
      console.log('✅ S3 bucket is accessible');
      return true;
    } else if (response.status === 404) {
      console.log('❌ S3 bucket not found');
      return false;
    } else {
      console.log(`⚠️  S3 bucket status unknown: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ S3 bucket check failed: ${error.message}`);
    return false;
  }
}

function checkConfigFiles() {
  const files = [
    'aws-s3-policy.json',
    'aws-s3-cors.json'
  ];
  
  let allFound = true;
  
  files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} found`);
    } else {
      console.log(`❌ ${file} not found`);
      allFound = false;
    }
  });
  
  return allFound;
}

function displaySummary(results) {
  console.log('\n📊 Configuration Summary:\n');
  
  Object.entries(results).forEach(([check, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${check}`);
  });
  
  const overallStatus = Object.values(results).every(Boolean);
  
  if (overallStatus) {
    console.log('\n🎉 All checks passed! You\'re ready to go.');
  } else {
    console.log('\n⚠️  Some checks failed. Review the issues above.');
    console.log('\n💡 Tips:');
    console.log('   - Run `npm run setup:aws` to create config files');
    console.log('   - Check AWS credentials and permissions');
    console.log('   - Ensure backend API is running (if not using mock mode)');
  }
}

// Main execution
async function main() {
  try {
    const results = {
      'Environment Configuration': checkEnvFile(),
      'Configuration Files': checkConfigFiles(),
      'API Health': await checkAPIHealth(),
      'S3 Bucket Access': await checkS3Bucket()
    };
    
    displaySummary(results);
    
  } catch (error) {
    console.error('❌ Configuration check failed:', error.message);
    process.exit(1);
  }
}

main();