// API Client communication helper with FastAPI backend

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async def_fetch(endpoint: string, options: RequestInit = {}):
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Set default credentials include to allow session cookies
  const defaultOptions: RequestInit = {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  const response = await fetch(url, defaultOptions);
  
  if (response.status === 401) {
    // Session expired or not logged in
    return { error: "unauthorized", status: 401 };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API error with status ${response.status}`);
  }

  return response.json();
}

export interface GoogleStatus {
  connected: boolean;
}

export interface WikimediaStatus {
  connected: boolean;
  username: string | null;
}

export interface PickerSessionResponse {
  picker_session_id: string;
  picker_uri: string;
}

export interface PollSessionResponse {
  ready: boolean;
}

export interface MediaItem {
  id: string;
  filename: string;
  mime_type: string;
  creation_time: string;
  width: number;
  height: number;
  base_url: string;
}

export interface GetMediaResponse {
  media_items: MediaItem[];
  count: number;
}

export interface UploadRequest {
  media_url: string;
  commons_filename: string;
  description: string;
  date?: string;
  license_code: string;
  categories: string[];
  lat?: number;
  lon?: number;
}

export interface UploadJobResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface UploadStatusResponse {
  job_id: string;
  filename: string;
  status: "queued" | "uploading" | "success" | "failed";
  progress_bytes: number;
  total_bytes: number;
  error: string | null;
  description_url: string | null;
  url: string | null;
}

export interface RateLimitsResponse {
  ratelimits: Record<string, any>;
}

export const api = {
  // Google OAuth Status
  getGoogleStatus: (): Promise<GoogleStatus> => 
    def_fetch("/auth/google/status"),
    
  disconnectGoogle: (): Promise<{ status: string; message: string }> => 
    def_fetch("/auth/google/disconnect", { method: "POST" }),
    
  // Wikimedia OAuth Status
  getWikimediaStatus: (): Promise<WikimediaStatus> => 
    def_fetch("/auth/wikimedia/status"),
    
  disconnectWikimedia: (): Promise<{ status: string; message: string }> => 
    def_fetch("/auth/wikimedia/disconnect", { method: "POST" }),
    
  // Picker Session Flow
  createPickerSession: (): Promise<PickerSessionResponse> => 
    def_fetch("/picker/session", { method: "POST" }),
    
  pollPickerSession: (pickerSessionId: string): Promise<PollSessionResponse> => 
    def_fetch(`/picker/session/${pickerSessionId}/poll`),
    
  getPickedMedia: (pickerSessionId: string): Promise<GetMediaResponse> => 
    def_fetch(`/picker/media/${pickerSessionId}`),
    
  // Upload Service Flow
  startUploadJob: (payload: UploadRequest): Promise<UploadJobResponse> => 
    def_fetch("/upload", { 
      method: "POST", 
      body: JSON.stringify(payload) 
    }),
    
  getUploadStatus: (jobId: string): Promise<UploadStatusResponse> => 
    def_fetch(`/upload/status/${jobId}`),
    
  getUploadLimits: (): Promise<RateLimitsResponse> => 
    def_fetch("/upload/limits")
};
