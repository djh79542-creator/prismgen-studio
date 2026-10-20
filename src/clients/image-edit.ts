// Remote ModelHub service for frontend use
// This service makes HTTP requests to the backend API instead of calling ModelHub directly

import { PRISM_API_BASE_URL, authorizedFetch } from '../platform/api';

export interface EditImageResult {
  imageUrl: string | null;
  text: string | null;
}

export interface SecondaryImage {
  base64: string;
  mimeType: string;
}

/**
 * Edit an image using the backend API
 * @param base64ImageData - Base64 encoded image data (null for text-to-image)
 * @param mimeType - MIME type of the image (null for text-to-image)
 * @param prompt - Text prompt for editing/generation
 * @param maskBase64 - Base64 encoded mask data (optional)
 * @param secondaryImage - Secondary image data (optional)
 * @returns Promise with the edited image result
 */
export async function editStill(
  base64ImageData: string | null,
  mimeType: string | null,
  prompt: string,
  maskBase64?: string,
  secondaryImage?: SecondaryImage
): Promise<EditImageResult> {
  try {
    const response = await authorizedFetch('/api/studio/image-edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64ImageData,
        mimeType,
        prompt,
        maskBase64,
        secondaryImage,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        // If response is not JSON, use the status text or default message
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    try {
      const result = await response.json();
      return result;
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new Error('Server returned invalid JSON response');
    }
  } catch (error) {
    console.error('Error calling remote edit image API:', error);
    throw error;
  }
}

/**
 * Generate an image from text prompt only
 * @param prompt - Text prompt for image generation
 * @returns Promise with the generated image result
 */
export async function generateImageFromText(prompt: string): Promise<EditImageResult> {
  return editStill(null, null, prompt);
}