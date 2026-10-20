// Frontend remote service to call backend video generation APIs
import { authorizedFetch } from '../platform/api';


export interface StartVideoResponse { task_id: string }
export interface VideoStatusResponse { status: string; videoUrl?: string }

export async function requestMotionJob(imageDataUrl: string, prompt: string, duration: number): Promise<StartVideoResponse> {
  const resp = await authorizedFetch('/api/motion/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, prompt, duration }),
  });
  if (!resp.ok) {
    throw new Error('failure.unified');
  }
  return resp.json();
}

export async function pollMotionJob(id: string): Promise<VideoStatusResponse> {
  const resp = await authorizedFetch(`/api/motion/result?task_id=${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  if (!resp.ok) {
    throw new Error('failure.unified');
  }
  return resp.json();
}
