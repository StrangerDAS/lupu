const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const MONGODB_URI = 'mongodb+srv://briniauser:%409YRSW*_WuV%24R%238@brinia-cluster.mkxkyau.mongodb.net/lupu?appName=brinia-cluster';
const JWT_SECRET = 'lupu-prod-jwt-secret-change-before-deploy-2024';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.collection('users');
    
    // Find super admin
    const user = await db.findOne({ role: 'super_admin' }) || await db.findOne({ role: 'founder' });
    if (!user) throw new Error('No admin user found');
    
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const authState = {
      state: {
        user: user,
        token: token,
        authReady: true,
        permissions: [],
        accountStatus: null
      },
      version: 0
    };

    console.log('Launching browser...');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Go to login page just to set origin for localstorage
    await page.goto('http://localhost:5174/auth/login');
    
    await page.evaluate((state) => {
      localStorage.setItem('lupu-auth', JSON.stringify(state));
    }, authState);

    console.log('Navigating to Owner Setup view...');
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/uploads/')) {
        console.log(`[NETWORK] ${response.request().method()} ${url} -> ${response.status()}`);
      }
    });

    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
    });

    page.on('pageerror', err => {
      console.log('[REACT RUNTIME ERROR]', err.message);
    });

    await page.goto('http://localhost:5174/owner/setup', { waitUntil: 'networkidle2' });
    
    // Wait for data to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Let's click on a user that has KYC docs
    // In UsersView, we need to click "Review Documents" or similar
    // Actually, maybe the images are visible right away?
    // Wait, let's just extract ALL img src attributes from the page.
    console.log('Extracting all img src attributes...');
    const imgs = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.map(img => {
        const comp = window.getComputedStyle(img);
        return {
          src: img.src,
          alt: img.alt,
          display: comp.display,
          visibility: comp.visibility,
          width: comp.width,
          height: comp.height,
          objectFit: comp.objectFit,
          complete: img.complete,
          naturalWidth: img.naturalWidth
        }
      });
    });

    console.log('Images found:', JSON.stringify(imgs, null, 2));
    
    await browser.close();
    await mongoose.disconnect();
    console.log('Done.');
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

run();
