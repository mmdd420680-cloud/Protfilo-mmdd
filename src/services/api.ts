import axios from 'axios';

const SESSION_TOKEN_KEY = 'mahim_cms_session_token';

let memoryAuthToken: string | null = null;

export function setClientAuthToken(token: string | null): void {
  memoryAuthToken = token;
  try {
    if (token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage restrictions in private contexts
  }
}

export function getClientAuthToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getClientAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractApiErrorMessage(err: unknown, fallback = 'Operation failed.'): string {
  if (axios.isAxiosError(err)) {
    const serverMsg = err.response?.data?.error?.message;
    if (typeof serverMsg === 'string' && serverMsg.trim()) {
      return serverMsg;
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function uploadMediaAsset(file: File): Promise<{
  _id: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}
