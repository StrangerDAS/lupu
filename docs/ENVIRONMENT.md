# LUPU Environment Variables & Deployment Guide

This document catalogs all environment variables used by the backend and frontend configurations, plus instructions for deployment.

---

## 💻 Backend Environment Variables (`backend/.env`)

Create a `.env` file in the `backend/` directory based on the following schema:

| Variable | Required | Default Value | Description |
|----------|----------|---------------|-------------|
| `PORT` | No | `5001` | The network port the Express API listens on. |
| `NODE_ENV` | No | `development` | Server run mode. Set to `'production'` in production to disable verbose logs and console developer OTP printing. |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/lupu` | MongoDB connection string. Replace with your MongoDB Atlas Cluster URI in production. |
| `JWT_SECRET` | Yes | *Required in Prod* | Secret key for signing JSON Web Tokens. Must be a secure 64+ char random hex string in production. |
| `JWT_EXPIRES_IN` | No | `7d` | Lifespan expiration duration for signed client sessions. |
| `ALLOWED_ORIGINS` | No | *Localhost Dev list* | Comma-separated list of browser origins permitted to bypass CORS security policies. |
| `RAZORPAY_KEY_ID` | Yes | `YOUR_RAZORPAY_KEY_ID` | Razorpay Account API Key. Leave as default placeholder to enable simulated payment checkout modes. |
| `RAZORPAY_KEY_SECRET` | Yes | `YOUR_RAZORPAY_KEY_SECRET` | Razorpay Account secret key matching Key ID. |

### Generating a Secure JWT Secret
For production environments, generate a cryptographically secure key:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🎨 Frontend Environment Variables (`frontend/.env`)

Vite requires environment variables to be prefixed with `VITE_` to expose them to client-side bundles.

Create a `.env` file in the `frontend/` directory based on the following schema:

| Variable | Required | Default Value | Description |
|----------|----------|---------------|-------------|
| `VITE_API_URL` | Yes | `/api` | Base URL routing endpoint for proxying REST API calls to the Express server. |
| `VITE_RAZORPAY_KEY_ID` | Yes | `YOUR_RAZORPAY_KEY_ID` | Exposes your public Razorpay API Key to initialize the payment checkout window in client browsers. |
| `VITE_FIREBASE_API_KEY` | Yes | *Required* | Firebase Web SDK configuration parameter. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | *Required* | Firebase Web SDK configuration parameter. |
| `VITE_FIREBASE_PROJECT_ID` | Yes | *Required* | Firebase Web SDK configuration parameter. |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | *Required* | Firebase Web SDK configuration parameter. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | *Required* | Firebase Web SDK configuration parameter. |
| `VITE_FIREBASE_APP_ID` | Yes | *Required* | Firebase Web SDK configuration parameter. |

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
1. Set client-side variables during build time (`VITE_API_URL`, `VITE_RAZORPAY_KEY_ID`, and Firebase keys).
2. Compile client production bundle:
   ```bash
   npm run build
   ```
3. Deploy the compile output directory (`dist/`) to static CDNs or web hosting providers (Vercel, Netlify, or AWS S3).
