import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const BASE_URL = 'http://localhost:5001/api';
const STATIC_URL = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'lupu-prod-jwt-secret-change-before-deploy-2024';

async function generateDummyImage(filename) {
  const filepath = path.join(__dirname, filename);
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

async function run() {
  console.log('--- E2E Upload Test ---');
  let token;
  let userId;
  
  const dummyImgPath = await generateDummyImage('dummy.png');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('1. Connected to DB');
    
    // 1. Create a user directly in DB to bypass OTP
    const email = `test_uploader_${Date.now()}@example.com`;
    const user = {
      name: 'Test Uploader',
      email,
      role: 'founder', // Super admin
      isRider: true,
      isOwner: true,
      otpVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await mongoose.connection.collection('users').insertOne(user);
    userId = result.insertedId;
    console.log(`User created. ID: ${userId}`);

    // Generate token
    token = jwt.sign({ id: userId.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // 2. Upload KYC
    console.log('\n2. Uploading KYC...');
    const kycForm = new FormData();
    kycForm.append('governmentIdUrl', fs.createReadStream(dummyImgPath));
    kycForm.append('collegeIdUrl', fs.createReadStream(dummyImgPath));

    const kycRes = await axios.post(`${BASE_URL}/users/kyc`, kycForm, {
      headers: {
        ...kycForm.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    
    const govUrl = kycRes.data.user.governmentIdUrl;
    const colUrl = kycRes.data.user.collegeIdUrl;
    console.log(`KYC uploaded.\nGov: ${govUrl}\nCol: ${colUrl}`);

    // 3. Confirm files exist in backend/uploads
    console.log('\n3. Checking filesystem for uploads...');
    const files = fs.readdirSync(path.join(__dirname, 'uploads'));
    if (!files.some(f => govUrl.includes(f))) throw new Error('Gov ID file missing');
    if (!files.some(f => colUrl.includes(f))) throw new Error('Col ID file missing');
    console.log('Files confirmed on disk.');

    // 4. Confirm MongoDB stores correct paths
    console.log('\n4. Checking MongoDB...');
    const dbUser = await mongoose.connection.collection('users').findOne({ _id: userId });
    console.log(`DB governmentIdUrl: ${dbUser.governmentIdUrl}`);
    console.log(`DB collegeIdUrl: ${dbUser.collegeIdUrl}`);
    if (dbUser.governmentIdUrl !== govUrl || dbUser.collegeIdUrl !== colUrl) {
      throw new Error('MongoDB paths do not match API response');
    }

    // 5. Open exact image URL and verify HTTP 200
    console.log('\n5. Verifying image URLs via HTTP...');
    const fullGovUrl = `${STATIC_URL}${govUrl}`;
    const httpRes = await axios.get(fullGovUrl);
    console.log(`GET ${fullGovUrl} -> Status ${httpRes.status}`);
    if (httpRes.status !== 200) throw new Error(`Expected 200, got ${httpRes.status}`);

    // 7. Repeat for Vehicle Images
    console.log('\n7. Uploading Vehicle...');
    const vehForm = new FormData();
    vehForm.append('name', 'Test Bike');
    vehForm.append('brand', 'Royal Enfield');
    vehForm.append('model', 'Classic');
    vehForm.append('registrationNumber', 'AS-00-0000');
    vehForm.append('pricePerHour', '100');
    vehForm.append('pricePerDay', '500');
    vehForm.append('description', 'Test desc');
    vehForm.append('verificationStatus', 'submitted');
    
    vehForm.append('RC', fs.createReadStream(dummyImgPath));
    vehForm.append('Insurance', fs.createReadStream(dummyImgPath));
    vehForm.append('PUC', fs.createReadStream(dummyImgPath));
    vehForm.append('photos', fs.createReadStream(dummyImgPath));
    vehForm.append('photos', fs.createReadStream(dummyImgPath));
    vehForm.append('photos', fs.createReadStream(dummyImgPath));

    const vehRes = await axios.post(`${BASE_URL}/vehicles`, vehForm, {
      headers: {
        ...vehForm.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    const vehicleId = vehRes.data._id;
    const rcUrl = vehRes.data.documents.RC;
    const thumbUrl = vehRes.data.thumbnail || vehRes.data.images[0] || vehRes.data.photos[0];
    console.log(`Vehicle uploaded! ID: ${vehicleId}`);
    console.log(`RC Path: ${rcUrl}`);
    console.log(`Thumbnail Path: ${thumbUrl}`);

    const dbVeh = await mongoose.connection.collection('vehicles').findOne({ _id: new mongoose.Types.ObjectId(vehicleId) });
    console.log(`DB RC Path: ${dbVeh.documents.RC}`);
    console.log(`DB Thumbnail: ${dbVeh.thumbnail}`);
    
    const fullThumbUrl = `${STATIC_URL}${thumbUrl}`;
    const thumbHttpRes = await axios.get(fullThumbUrl);
    console.log(`GET ${fullThumbUrl} -> Status ${thumbHttpRes.status}`);
    if (thumbHttpRes.status !== 200) throw new Error(`Expected 200, got ${thumbHttpRes.status}`);
    
    console.log('\n✅ Script verification passed!');
    
  } catch (err) {
    console.error('❌ Error during flow:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
    process.exit(1);
  } finally {
    if (fs.existsSync(dummyImgPath)) {
      fs.unlinkSync(dummyImgPath);
    }
    await mongoose.disconnect();
  }
}

run();
