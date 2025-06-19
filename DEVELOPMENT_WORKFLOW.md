# Development Workflow Guide

## Quick Start

### 1. Backend Setup
```bash
# Terminal 1: Start backend
cd chrome-screen-capture-api
npm run dev

# Verify backend is running
curl http://localhost:3001/api/health
```

### 2. Frontend Setup
```bash
# Terminal 2: Start frontend with real backend
cd chrome-extension-frontend
npm run dev:real

# Or with mock mode for testing
npm run dev:mock
```

### 3. Test Integration
```bash
# Test full integration
npm run test:integration
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev:real` | Use real backend API |
| `npm run dev:mock` | Use mock/simulated data |
| `npm run build:real` | Build for production with real API |
| `npm run build:mock` | Build for testing with mock data |
| `npm run test:integration` | Test backend connectivity |

## Environment Configuration

### Development (.env.development)
```bash
VITE_API_BASE_URL=http://localhost:3001/api
VITE_ENABLE_MOCK_MODE=false
```

### Production (.env.production) 
```bash
VITE_API_BASE_URL=https://your-api-domain.com/api
VITE_ENABLE_MOCK_MODE=false
```

## Debugging

### Check Service Status
```javascript
// In browser console
console.log('Service Status:', window.serviceManager?.getServiceStatus());
```

### Check Configuration
```javascript
// In browser console
console.log('AWS Config:', window.awsConfig);
```

### Backend Logs
```bash
# In backend directory
npm run logs
```

## Common Issues

### 1. CORS Errors
- Ensure backend CORS is configured for `chrome-extension://*`
- Check browser console for specific CORS errors

### 2. Authentication Issues
- Verify backend is running on correct port
- Check API base URL in environment file
- Ensure JWT secret is configured

### 3. Upload Issues
- Verify AWS credentials in backend
- Check S3 bucket permissions
- Test presigned URL generation

## Production Deployment

### 1. Deploy Backend
```bash
# Build and deploy backend to AWS/DigitalOcean/etc
cd chrome-screen-capture-api
npm run build
# Deploy to your hosting service
```

### 2. Update Frontend Config
```bash
# Update production API URL
# .env.production
VITE_API_BASE_URL=https://your-deployed-api.com/api
```

### 3. Build Extension
```bash
# Build for Chrome Web Store
npm run build:real
```
