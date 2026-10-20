// Upload service for handling file uploads to server

interface UploadResponse {
  success: boolean;
  file?: {
    id: string;
    filename: string;
    url: string;
    size: number;
    uploadTime: string;
    type: string;
  };
  error?: string;
}

interface UploadListResponse {
  files: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
    uploadTime: string;
    type: string;
  }>;
}

import { PRISM_API_BASE_URL, authorizedFetch } from '../platform/api';

export const assetsClient = {
  // Upload a single file to server
  async uploadFile(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await authorizedFetch('/api/assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  },

  // Get list of all uploaded files
  async getUploadedFiles(): Promise<UploadListResponse> {
    try {
      const response = await authorizedFetch('/api/assets');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch uploads: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching uploads:', error);
      return { files: [] };
    }
  },

  // Fetch history files for current user
  async getHistoryFiles(): Promise<{ success: boolean; files?: Array<{ id: string; imageUrl: string; type: string; timestamp: number; filename: string }>; error?: string }> {
    try {
      const response = await authorizedFetch('/api/gallery');
      if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
      }
      const files = await response.json();
      // The server returns an array; wrap it in a success payload
      return { success: true, files };
    } catch (error) {
      console.error('Error fetching history:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch history' };
    }
  },

  // Delete a file from server
  async deleteFile(filename: string, bucket: string = 'inputs'): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await authorizedFetch(`/api/assets/${bucket}/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  },

  // Get full URL for uploaded file
  getFileUrl(relativePath: string): string {
    // 使用相对路径，通过 Vite 代理
    return relativePath;
  }
};