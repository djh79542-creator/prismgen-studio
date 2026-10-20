

export interface Preset {
  key: string;
  titleKey: string;
  emoji: string;
  prompt?: string;
  descriptionKey?: string;
  items?: Preset[];
  isMultiImage?: boolean;
  isSecondaryOptional?: boolean;
  isDoubleModel?: boolean;
  isTwoStep?: boolean;
  stepTwoPrompt?: string;
  primaryUploaderTitle?: string;
  secondaryUploaderTitle?: string;
  primaryUploaderDescription?: string;
  secondaryUploaderDescription?: string;
  // 新增：单上传器的国际化描述键
  singleUploaderDescription?: string;
  isVideo?: boolean;
}

export interface RenderResult {
  imageUrl: string | null;
  text: string | null;
  secondaryImageUrl?: string | null;
  videoUrl?: string;
  // Optional labels to override UI captions when showing two images
  primaryLabel?: string | null;
  secondaryLabel?: string | null;
}

export interface AssetRecord {
  id: string;
  filename: string;
  url: string;
  size: number;
  uploadTime: string;
  type: string;
  dimensions?: {
    width: number;
    height: number;
  };
}
