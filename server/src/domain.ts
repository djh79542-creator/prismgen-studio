export interface RenderResult {
  imageUrl: string | null;
  text: string | null;
  secondaryImageUrl?: string | null;
  videoUrl?: string;
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
}
