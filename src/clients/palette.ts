// Remote Palette service for frontend use
// This service makes HTTP requests to the backend API instead of calling Palette directly

import { PRISM_API_BASE_URL, authorizedFetch } from '../platform/api';

export interface EditImageResult {
  imageUrl: string | null;
  text: string | null;
  taskId?: string;
  xDate?: string;
}

export interface SecondaryImage {
  base64: string;
  mimeType: string;
}

/**
 * Edit an image using 色板模型 via backend API
 */
export async function editStill(
  base64ImageData: string | null,
  mimeType: string | null,
  prompt: string,
  secondaryImage?: SecondaryImage
): Promise<EditImageResult> {
  try {
    const response = await authorizedFetch('/api/studio/palette-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64ImageData, mimeType, prompt, secondaryImage }),
    });

    const respClone = response.clone();

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        // Prefer JSON error body, fallback to text
        try {
          const errorData = await response.json();
          errorMessage = (errorData as any)?.error || errorMessage;
        } catch {
          const text = await respClone.text();
          errorMessage = text?.trim().length ? text : response.statusText || errorMessage;
        }
      } catch (jsonError) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Robust JSON parsing: clone first, then parse with fallback to text
    try {
      const result = await response.json();
      return result;
    } catch {
      const text = await respClone.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Server returned empty JSON body');
      }
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        throw new Error(`Server returned invalid JSON: ${text.slice(0, 200)}`);
      }
    }
  } catch (error) {
    console.error('Error calling remote Palette edit image API:', error);
    throw error;
  }
}

/**
 * Query Palette task status and return final imageUrl when ready.
 */
export async function pollAsyncResult(taskId: string, maxWaitMs = 60000, intervalMs = 2000): Promise<{ imageUrl: string | null; status: string }> {
  try {
    const response = await authorizedFetch('/api/studio/palette-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, maxWaitMs, intervalMs }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling remote Palette status API:', error);
    throw error;
  }
}
