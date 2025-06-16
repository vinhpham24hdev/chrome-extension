// scripts/setup-aws.js - AWS Setup Helper Script
const fs = require('fs');
const path = require('path');

console.log('🚀 AWS S3 Setup Helper for Screen Capture Tool\n');

// Configuration templates
const envTemplate = `# AWS Configuration
AWS_S3_BUCKET_NAME=screen-capture-tool-dev
AWS_REGION=us-east-1
API_BASE_URL=http://localhost:3001/api

# File Upload Settings  
MAX_FILE_SIZE=104857600
ENABLE_MOCK_MODE=true

# API Configuration
API_TIMEOUT=10000
UPLOAD_TIMEOUT=600000

# Development Settings
NODE_ENV=development
DEBUG_MODE=true
`;

const s3PolicyTemplate = {
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowChromeExtensionUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*",
      "Condition": {
        "StringLike": {
          "s3:x-amz-content-sha256": "*"
        }
      }
    },
    {
      "Sid": "AllowPresignedUrls",
      "Effect": "Allow",
      "Principal": "*",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
};

const corsConfigTemplate = [
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "chrome-extension://*",
      "moz-extension://*",
      "http://localhost:*",
      "https://your-domain.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
];

// Helper functions
function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env.development');
  
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env.development already exists. Skipping...');
    return;
  }
  
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.development file');
}

function createS3PolicyFile() {
  const policyPath = path.join(process.cwd(), 'aws-s3-policy.json');
  
  fs.writeFileSync(policyPath, JSON.stringify(s3PolicyTemplate, null, 2));
  console.log('✅ Created aws-s3-policy.json file');
}

function createCorsConfigFile() {
  const corsPath = path.join(process.cwd(), 'aws-s3-cors.json');
  
  fs.writeFileSync(corsPath, JSON.stringify(corsConfigTemplate, null, 2));
  console.log('✅ Created aws-s3-cors.json file');
}

function displayInstructions() {
  console.log('\n📋 Next Steps:\n');
  
  console.log('1. 🪣 Create S3 Bucket:');
  console.log('   aws s3 mb s3://screen-capture-tool-dev --region us-east-1\n');
  
  console.log('2. 🔒 Apply Bucket Policy:');
  console.log('   - Update YOUR_BUCKET_NAME in aws-s3-policy.json');
  console.log('   - aws s3api put-bucket-policy --bucket screen-capture-tool-dev --policy file://aws-s3-policy.json\n');
  
  console.log('3. 🌐 Configure CORS:');
  console.log('   aws s3api put-bucket-cors --bucket screen-capture-tool-dev --cors-configuration file://aws-s3-cors.json\n');
  
  console.log('4. 🔑 Create IAM User (for backend API):');
  console.log('   - Create user: aws iam create-user --user-name screen-capture-api');
  console.log('   - Attach policy: aws iam attach-user-policy --user-name screen-capture-api --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess');
  console.log('   - Create access key: aws iam create-access-key --user-name screen-capture-api\n');
  
  console.log('5. 🖥️  Setup Backend API:');
  console.log('   - Deploy backend service to handle presigned URLs');
  console.log('   - Update API_BASE_URL in .env.development');
  console.log('   - Test endpoint: GET /api/health\n');
  
  console.log('6. 🧪 Test Configuration:');
  console.log('   npm run check:config\n');
  
  console.log('7. 🚀 Run Development:');
  console.log('   npm run dev:mock    # Mock mode for development');
  console.log('   npm run dev:real    # Real AWS mode\n');
}

// Main execution
function main() {
  try {
    console.log('Creating configuration files...\n');
    
    createEnvFile();
    createS3PolicyFile();
    createCorsConfigFile();
    
    console.log('\n✨ AWS setup files created successfully!\n');
    
    displayInstructions();
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
