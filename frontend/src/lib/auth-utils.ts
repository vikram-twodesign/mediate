import { auth } from './firebase';

/**
 * Get the current user's ID token
 * @returns A promise that resolves to the ID token or null if no user is logged in
 */
export const getIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  
  if (!user) {
    return null;
  }
  
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
};

/**
 * Creates a fetch request with the Authorization header set to the current user's ID token
 * @param url The URL to fetch
 * @param options Additional fetch options
 * @returns A promise that resolves to the fetch response
 */
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getIdToken();
  
  if (!token) {
    throw new Error('User not authenticated');
  }
  
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Creates a authenticated API request to the backend
 * @param endpoint The API endpoint (without the base URL)
 * @param options Additional fetch options
 * @returns A promise that resolves to the fetch response
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  return fetchWithAuth(url, options);
}; 