# LUPU Environment Variables & Deployment Guide

This document catalogs all environment variables used by the backend and frontend configurations, plus instructions for deployment.

---

## 💻 Backend Environment Variables (`backend/.env`)

Create a `.env` file in the `backend/` directory based on the following schema:

| Variable | Required | Default Value | Description |
|----------|----------|---------------|-------------|
| `PORT` | No | `5001` | The network port the Express API listens on (Cloud providers set this dynamically). |
| `NODE_ENV` | Yes | `production` | Server run mode. Set to `'production'` in production to disable debug logs and enforce strict CORS. |
| `MONGODB_URI` | Yes | *Required in Prod* | MongoDB Atlas connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/lupu?retryWrites=true&w=majority`. |
| `JWT_SECRET` | Yes | *Required in Prod* | Secret key for signing JSON Web Tokens. Must be a secure 64+ char random hex string in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifespan expiration duration for signed client sessions. |
| `ALLOWED_ORIGINS` | Yes | `https://lupu.in,https://www.lupu.in` | Comma-separated list of browser origins permitted to bypass CORS security policies. |
| `FIREBASE_SERVICE_ACCOUNT` | Recommended | *None* | Minified JSON string of your Firebase Service Account credentials for Admin SDK token verification. |
| `FIREBASE_PROJECT_ID` | No | `uniride-9be37` | Firebase Project ID. |
| `FIREBASE_DATABASE_URL` | No | `https://uniride-9be37-default-rtdb.firebaseio.com` | Firebase Realtime Database URL. |
| *(Future Integration)* `RAZORPAY_KEY_ID` | No | `YOUR_RAZORPAY_KEY_ID` | Future Integration: Razorpay Account API Key. |
| *(Future Integration)* `RAZORPAY_KEY_SECRET` | No | `YOUR_RAZORPAY_KEY_SECRET` | Future Integration: Razorpay Account secret key. |

### Generating a Secure JWT Secret
For production environments, generate a cryptographically secure key:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🎨 Frontend Environment Variables (`frontend/.env`)

Vite requires environment variables to be prefixed with `VITE_` to expose them to client-side bundles.

Create a `.env` file in the `frontend/` directory (or set them in Vercel Project Settings → Environment Variables):

| Variable | Required | Production Value | Description |
|----------|----------|------------------|-------------|
| `VITE_API_URL` | Yes | `https://api.lupu.in/api` | Base URL routing endpoint for proxying REST API calls to the deployed Express server. |
| `VITE_FIREBASE_API_KEY` | Yes | `AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o` | Firebase Web SDK API Key. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | `uniride-9be37.firebaseapp.com` | Firebase Web SDK Auth Domain. |
| `VITE_FIREBASE_DATABASE_URL` | Yes | `https://uniride-9be37-default-rtdb.firebaseio.com` | Firebase Realtime Database URL. |
| `VITE_FIREBASE_PROJECT_ID` | Yes | `uniride-9be37` | Firebase Web SDK Project ID. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | `uniride-9be37.firebasestorage.app` | Firebase Web SDK Cloud Storage Bucket. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | `760677444428` | Firebase Cloud Messaging Sender ID. |
| `VITE_FIREBASE_APP_ID` | Yes | `1:760677444428:web:a419f39fd2dc273cbbfde9` | Firebase Web App ID. |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | `G-PKEVRXK33G` | Google Analytics Measurement ID. |
| *(Future Integration)* `VITE_RAZORPAY_KEY_ID` | No | `YOUR_RAZORPAY_KEY_ID` | Future Integration: Public Razorpay API Key. |

---

## 🚀 Deployment Guide

### Phase 1: MongoDB Database Preparation
1. Setup a MongoDB Atlas cluster or a standalone MongoDB instance.
2. White-list the deployment servers' IPs in the database network options.
3. Obtain the connection URI (e.g. `mongodb+srv://<user>:<password>@cluster.mongodb.net/lupu`).

### Phase 2: Backend Deployment
1. Set the system environment variables (`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, etc.).
2. Do **not** commit the `.env` file to version control.
3. Install production dependencies: `npm install --omit=dev`.
4. Run using a process supervisor (e.g. PM2):
   ```bash
   pm2 start server.js --name "lupu-backend"
   ```

### Phase 3: Frontend Deployment
1. Set client-side variables during build time (`VITE_API_URL` and Firebase keys).
2. Compile client production bundle:
   ```bash
   npm run build
   ```
3. Deploy the compile output directory (`dist/`) to static CDNs or web hosting providers (Vercel, Netlify, or AWS S3).
