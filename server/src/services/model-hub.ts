
import { GoogleGenAI, Modality } from "@google/genai";
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import type { RenderResult } from '../domain';

// 图片生成请求超时时间（毫秒），可通过环境变量覆盖
const MODELHUB_TIMEOUT_MS = parseInt(process.env.MODELHUB_TIMEOUT_MS || '120000', 10);

let ai: GoogleGenAI | null = null;
let proxyConfigured = false;

function safe(v?: string): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function configureGlobalProxy() {
  if (!proxyConfigured) {
    const proxyUrl = safe(process.env.OUTBOUND_PROXY_URL);
    if (proxyUrl) {
      try {
        const proxyAgent = new ProxyAgent(proxyUrl);
        setGlobalDispatcher(proxyAgent);
        proxyConfigured = true;
        console.log('✅ Global proxy configured successfully:', proxyUrl);
      } catch (error) {
        console.error('❌ Failed to configure proxy:', error);
        console.log('Continuing without proxy...');
      }
    } else {
      console.log('⚠️  No proxy URL configured, skipping proxy setup');
      console.log('If you encounter location restrictions, please configure OUTBOUND_PROXY_URL in .env.local');
    }
  }
}

function initializeAI() {
  if (!ai) {
    // Configure proxy before initializing AI
    configureGlobalProxy();

    const apiKey = safe(process.env.PRISM_MODELHUB_KEY);
    if (!apiKey) {
      throw new Error("PRISM_MODELHUB_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        baseUrl:  process.env.MODELHUB_BASE_URL,
        timeout: MODELHUB_TIMEOUT_MS,
      },
    });
  }
  return ai;
}

export async function editStill(
    base64ImageData: string | null,
    mimeType: string | null,
    prompt: string,
    maskBase64: string | null,
    secondaryImage: { base64: string; mimeType: string } | null
): Promise<RenderResult> {
  try {
    const aiInstance = initializeAI();
    let fullPrompt = prompt;
    const parts: any[] = [];

    // For promptOnly mode, enhance the prompt to explicitly request image generation
    if (!base64ImageData && !mimeType) {
      fullPrompt = `Generate an image based on this description: ${prompt}. Create a detailed, high-quality visual representation of the described scene or concept.`;
    }

    // Only add primary image if provided (for promptOnly mode, this will be null)
    if (base64ImageData && mimeType) {
      parts.push({
        inlineData: {
          data: base64ImageData,
          mimeType: mimeType,
        },
      });

      // The mask should immediately follow the image it applies to.
      if (maskBase64) {
        parts.push({
          inlineData: {
            data: maskBase64,
            mimeType: 'image/png', // Masks are always drawn as PNGs
          },
        });
        fullPrompt = `Apply the following instruction only to the masked area of the image: "${prompt}". Preserve the unmasked area.`;
      }
    }

    if (secondaryImage) {
        parts.push({
            inlineData: {
                data: secondaryImage.base64,
                mimeType: secondaryImage.mimeType,
            },
        });
    }

    parts.push({ text: fullPrompt });

    // 文生图与图改图共用同一个静帧模型
    const model = 'gemini-2.5-flash-image';

    // For promptOnly mode (text-to-image), use simplified API call
    if (parts.length === 1 && parts[0].text) {
      const response = await aiInstance.models.generateContent({
        model: model,
        contents: parts[0].text,
      });

      const result: RenderResult = { imageUrl: null, text: null };
      const responseParts = response.candidates?.[0]?.content?.parts;

      if (responseParts) {
        for (const part of responseParts) {
          if (part.text) {
            result.text = (result.text ? result.text + "\n" : "") + part.text;
          } else if (part.inlineData?.data) {
            const base64ImageBytes = part.inlineData.data;
            result.imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
          }
        }
      }

      if (!result.imageUrl) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let errorMessage = "The model did not return an image. It might have refused the request. Please try a different image or prompt.";

        if (finishReason === 'SAFETY') {
          const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
          errorMessage = `The request was blocked for safety reasons. Categories: ${blockedCategories || 'Unknown'}. Please modify your prompt or image.`;
        }

        throw new Error(errorMessage);
      }

      return result;
    }

    // For image editing mode, use complex API call with parts
    const response = await aiInstance.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const result: RenderResult = { imageUrl: null, text: null };

    // Safely access response parts to prevent crashes
    const responseParts = response.candidates?.[0]?.content?.parts;

    if (responseParts) {
      for (const part of responseParts) {
        if (part.text) {
          result.text = (result.text ? result.text + "\n" : "") + part.text;
        } else if (part.inlineData?.data) {
          const base64ImageBytes = part.inlineData.data;
          result.imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
      }
    }

    if (!result.imageUrl) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const safetyRatings = response.candidates?.[0]?.safetyRatings;
        let errorMessage = "The model did not return an image. It might have refused the request. Please try a different image or prompt.";

        if (finishReason === 'SAFETY') {
            const blockedCategories = safetyRatings?.filter(r => r.blocked).map(r => r.category).join(', ');
            errorMessage = `The request was blocked for safety reasons. Categories: ${blockedCategories || 'Unknown'}. Please modify your prompt or image.`;
        }

        throw new Error(errorMessage);
    }

    return result;

  } catch (error) {
    console.error("Error calling ModelHub API:", error);
    if (error instanceof Error) {
        let errorMessage = error.message;

        // Handle fetch failed / timeout error
        if (errorMessage.includes('fetch failed') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('UND_ERR_CONNECT_TIMEOUT')) {
            errorMessage = `网络请求超时或连接失败。图片生成模型响应较慢，可能原因：\n1. 代理/网络连接不稳定\n2. 请求超时（当前超时设置：${MODELHUB_TIMEOUT_MS / 1000}秒）\n3. 可通过环境变量 MODELHUB_TIMEOUT_MS 调大超时时间\n4. 请稍后重试`;
            throw new Error(errorMessage);
        }

        // Handle location restriction error
        if (errorMessage.includes('User location is not supported for the API use')) {
            errorMessage = "您的地理位置不支持使用此API。请检查以下解决方案：\n1. 确认代理服务器正在运行（当前配置：" + (process.env.OUTBOUND_PROXY_URL || '未配置') + "）\n2. 检查代理服务器是否能正常访问Google服务\n3. 尝试更换代理服务器地址\n4. 确认API密钥是否有效";
            throw new Error('failure.unified');
        }

        try {
            // The error message from the SDK might be a JSON string.
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.error && parsedError.error.message) {
                // Add a user-friendly message for common errors.
                if (parsedError.error.status === 'RESOURCE_EXHAUSTED') {
                    errorMessage = "You've likely exceeded the request limit. Please wait a moment before trying again.";
                } else if (parsedError.error.code === 500 || parsedError.error.status === 'UNKNOWN') {
                    errorMessage = "An unexpected server error occurred. This might be a temporary issue. Please try again in a few moments.";
                } else {
                    errorMessage = parsedError.error.message;
                }
            }
        } catch (e) {
            // Not a JSON string, use the original message.
        }
        throw new Error(errorMessage);
    }
    throw new Error('failure.unified');
  }
}

export async function generateVideo(
  prompt: string,
  imagePayload: { base64: string; mimeType: string } | null,
  aspectRatio: 'landscape' | 'portrait',
  onProgress?: (message: string) => void
): Promise<string> {
  if (onProgress) {
    onProgress('Initializing video generation...');
  }
  // Unified bilingual error message for video generation
  throw new Error('failure.unified');
}
