/**
 * Utility to reliably resolve image URLs from the backend.
 * 
 * Takes a path (e.g. '/uploads/image.jpg') and prepends the backend base URL,
 * bypassing the frontend's static origin which leads to 404s.
 */
export const getImageUrl = (path) => {
  if (!path) return '';
  
  // If the path is already an absolute URL (e.g., Firebase storage, S3, or external), return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Determine backend base URL from environment
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  
  // Strip '/api' from the end of VITE_API_URL to get the root backend host
  // If VITE_API_URL is relative (like '/api'), this correctly evaluates to an empty string,
  // allowing the browser to resolve the relative path via Vite's proxy.
  const host = apiBase.replace(/\/api\/?$/, '');
  
  // Ensure the path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${host}${normalizedPath}`;
};
