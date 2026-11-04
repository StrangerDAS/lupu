const DEFAULT_BACKEND_HOST = process.env.EXPO_PUBLIC_API_URL
  ? process.env.EXPO_PUBLIC_API_URL.replace(/\/api\/?$/, '')
  : 'https://lupu-backend.onrender.com';

export const DEFAULT_BIKE_IMG =
  'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80';
export const DEFAULT_SCOOTY_IMG =
  'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80';

/**
 * Extracts and deduplicates all valid image URLs from vehicle data.
 * Supports images array, photos array, imageUrl, image, photo strings, and fallback.
 */
export function getVehicleImages(vehicle) {
  if (!vehicle) return [DEFAULT_BIKE_IMG];

  const rawList = [];
  if (Array.isArray(vehicle.images)) rawList.push(...vehicle.images);
  if (Array.isArray(vehicle.photos)) rawList.push(...vehicle.photos);
  if (typeof vehicle.imageUrl === 'string') rawList.push(vehicle.imageUrl);
  if (typeof vehicle.image === 'string') rawList.push(vehicle.image);
  if (typeof vehicle.photo === 'string') rawList.push(vehicle.photo);

  const seen = new Set();
  const cleaned = [];
  for (const item of rawList) {
    if (item && typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        cleaned.push(trimmed);
      }
    }
  }

  if (cleaned.length === 0) {
    const isScooty = (vehicle.type || '').toLowerCase().includes('scoot');
    cleaned.push(isScooty ? DEFAULT_SCOOTY_IMG : DEFAULT_BIKE_IMG);
  }

  return cleaned;
}

/**
 * Optimizes image URLs for mobile display:
 * 1. Cloudinary URLs get f_auto, q_auto, and size capping.
 * 2. Relative URLs (/uploads/...) resolve against active backend host.
 */
export function optimizeMobileImageUrl(url, fullScreen = false) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const widthCap = fullScreen ? 1200 : 800;

  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/image/upload/')) {
    const parts = trimmed.split('/image/upload/');
    const rest = (parts[1] || '').replace(/^v\d+\//, '');
    return `${parts[0]}/image/upload/f_auto,q_auto,w_${widthCap},c_fill,g_auto/${rest}`;
  }

  if (trimmed.startsWith('/')) {
    return `${DEFAULT_BACKEND_HOST}${trimmed}`;
  }

  return trimmed;
}

