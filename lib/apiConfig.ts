/**
 * API Configuration
 * Central configuration for all API endpoints
 * Automatically uses environment variables or falls back to localhost for development
 */

// Get the backend API URL from environment variable or default to localhost
export const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Get the backend base URL (without /api) for WebSocket and static files
export const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001';

// Helper function to get the full API URL
export const getApiUrl = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // If path already includes /api, use base URL
  if (cleanPath.startsWith('api/')) {
    return `${BACKEND_BASE_URL}/${cleanPath}`;
  }
  
  // Otherwise use API URL
  return `${BACKEND_API_URL}/${cleanPath}`;
};

// Helper function to get static file URL
export const getStaticUrl = (path: string): string => {
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  return `${BACKEND_BASE_URL}/${cleanPath}`;
};

// Export configuration object for easy import
export const API_CONFIG = {
  baseUrl: BACKEND_BASE_URL,
  apiUrl: BACKEND_API_URL,
  getApiUrl,
  getStaticUrl,
} as const;

export default API_CONFIG;
