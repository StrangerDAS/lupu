# LUPU Backend API Documentation

All API endpoints are prefixed with `/api`. 
Secure endpoints require a bearer JWT token: `Authorization: Bearer <token>`.

---

## 🔐 Authentication Endpoints

### 1. Send OTP
* **URL**: `/api/auth/send-otp`
* **Method**: `POST`
* **Auth Required**: No
* **Rate Limited**: Max 3 requests per IP/Identifier per minute
* **Request Body**:
```json
{
  "identifier": "renter@lupu.in" // Email or phone number
}
```
* **Success Response (200 OK)**:
```json
{
  "message": "OTP sent successfully",
  "_dev_otp": "123456" // Returned in development mode only
}
```

### 2. Sign Up
* **URL**: `/api/auth/signup`
* **Method**: `POST`
* **Auth Required**: No
* **Request Body**:
```json
{
  "identifier": "newuser@lupu.in",
  "otp": "123456",
  "name": "Jane Doe",
  "role": "user" // 'user' or 'owner'
}
```
* **Success Response (201 Created)**:
```json
{
  "user": {
    "_id": "603d2b2f8a5a4c001f3e7456",
    "name": "Jane Doe",
    "email": "newuser@lupu.in",
    "role": "user",
    "isRider": true,
    "isOwner": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Log In
* **URL**: `/api/auth/login`
* **Method**: `POST`
* **Auth Required**: No
* **Rate Limited**: Max 5 attempts per IP/Identifier per minute
* **Request Body**:
```json
{
  "identifier": "renter@lupu.in",
  "otp": "123456"
}
```
* **Success Response (200 OK)**:
```json
{
  "user": {
    "_id": "603d2b2f8a5a4c001f3e7456",
    "name": "Renter User",
    "email": "renter@lupu.in",
    "role": "user",
    "isRider": true,
    "isOwner": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Fetch Current User Session
* **URL**: `/api/auth/me`
* **Method**: `GET`
* **Auth Required**: Yes
* **Success Response (200 OK)**:
```json
{
  "_id": "603d2b2f8a5a4c001f3e7456",
  "name": "Renter User",
  "email": "renter@lupu.in",
  "role": "user"
}
```

---

## 🏍️ Vehicle & Access Listings Endpoints

### 1. Fetch Approved Listings
* **URL**: `/api/vehicles`
* **Method**: `GET`
* **Auth Required**: No
* **Success Response (200 OK)**:
```json
{
  "vehicles": [
    {
      "_id": "603d2b2f8a5a4c001f3e7111",
      "name": "Royal Enfield Classic 350",
      "brand": "Royal Enfield",
      "pricePerHour": 120,
      "isLive": true,
      "status": "approved"
    }
  ]
}
```

### 2. Fetch Owner's Listings
* **URL**: `/api/vehicles/my`
* **Method**: `GET`
* **Auth Required**: Yes (Must be Owner or Admin)
* **Success Response (200 OK)**:
```json
{
  "vehicles": [...]
}
```

### 3. Create Vehicle Draft
* **URL**: `/api/vehicles`
* **Method**: `POST`
* **Auth Required**: Yes (Must be Owner)
* **Consumes**: `multipart/form-data`
* **Fields**: `name`, `brand`, `model`, `pricePerHour`, `registrationNumber`, `description`, etc.
* **Files**: `RC` (1 file), `Insurance` (1 file), `PUC` (1 file), `photos` (multiple files)
* **Success Response (201 Created)**:
```json
{
  "_id": "603d2b2f8a5a4c001f3e7222",
  "name": "Honda Activa 6G",
  "verificationStatus": "submitted"
}
```

---

## 📅 Booking Endpoints

### 1. Create Booking
* **URL**: `/api/bookings`
* **Method**: `POST`
* **Auth Required**: Yes
* **Request Body**:
```json
{
  "items": [
    { "itemId": "603d2b2f8a5a4c001f3e7111", "price": 360 }
  ],
  "startTime": "2026-07-20T09:00:00Z",
  "endTime": "2026-07-20T12:00:00Z",
  "agreementAccepted": true
}
```
* **Success Response (201 Created)**:
```json
{
  "_id": "603d2b2f8a5a4c001f3e7999",
  "userId": { "_id": "603d2b2f8a5a4c001f3e7456", "name": "Renter User" },
  "items": [...],
  "totalAmount": 360,
  "status": "confirmed"
}
```

---

## 💳 Payments Endpoints

### 1. Create Razorpay Payment Order
* **URL**: `/api/payments/create-order`
* **Method**: `POST`
* **Auth Required**: Yes
* **Request Body**:
```json
{
  "amount": 500, // Amount in INR
  "receipt": "receipt_1234"
}
```
* **Success Response (200 OK)**:
```json
{
  "id": "order_mock_1700000000000",
  "amount": 50000, // Amount in paise
  "currency": "INR",
  "status": "created",
  "isMock": true // Included if mock order created
}
```
