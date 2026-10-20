

import type { Preset } from './domain';

export const PRESETS: Preset[] = [
  // Moved custom prompt to the top and enabled multi-image
  {
    key: "freeform",
    titleKey: "presets.items.freeform.title",
    prompt: "CUSTOM",
    emoji: "✍️",
    descriptionKey: "presets.items.freeform.description",
    isMultiImage: true,
    isSecondaryOptional: true,
    primaryUploaderTitle: "presets.items.freeform.uploader1Title",
    primaryUploaderDescription: "presets.items.freeform.uploader1Desc",
    secondaryUploaderTitle: "presets.items.freeform.uploader2Title",
    secondaryUploaderDescription: "presets.items.freeform.uploader2Desc",
  },
  {
    key: "draftFromSketch",
    titleKey: "presets.items.draftFromSketch.title",
    prompt: "Convert hand-drawn sketches into high-fidelity design drawings, preserve the primary lines and structure, optimize details, remove annotation text, dimension lines, and auxiliary lines, and generate high-definition, professional, plain line-structure drawings without colors or patterns.",
    emoji: "💡",
    descriptionKey: "presets.items.draftFromSketch.description",
    // 单上传器提示词
    singleUploaderDescription: "presets.items.draftFromSketch.uploaderDesc",
  },
  {
    key: "sketchToObject",
    titleKey: "presets.items.sketchToObject.title",
    prompt: "turn this illustration into realistic version\n" +
        "Show both sides\n" +
        "No models",
    emoji: "👗",
    descriptionKey: "presets.items.sketchToObject.description",
    // 单上传器提示词
    singleUploaderDescription: "presets.items.sketchToObject.uploaderDesc",
  },
  {
    key: "swapSurface",
    titleKey: "presets.items.swapSurface.title",
    prompt: "Using the product photo from Image 1, apply the fabric texture or color scheme from Image 2. Intelligently identify the product structure, replace the material texture and color with one click, while maintaining consistent lighting and shadows for a natural, seamless integration.",
    emoji: "🎨",
    descriptionKey: "presets.items.swapSurface.description",
    isMultiImage: true,
    isSecondaryOptional: false,
    primaryUploaderTitle: "presets.items.swapSurface.uploader1Title",
    primaryUploaderDescription: "presets.items.swapSurface.uploader1Desc",
    secondaryUploaderTitle: "presets.items.swapSurface.uploader2Title",
    secondaryUploaderDescription: "presets.items.swapSurface.uploader2Desc",
  },
  {
    key: "drapeOnModel",
    titleKey: "presets.items.drapeOnModel.title",
    prompt: "Generate a Chinese female model wearing all the garments and accessories from the image, with natural lighting and a clear full-body shot, rendered as if taken in a professional studio setting. The output photo must feature high-definition, high-resolution details of both the model and the clothing.",
    emoji: "‍🧍‍♀️",
    descriptionKey: "presets.items.drapeOnModel.description",
    // 单上传器提示词
    singleUploaderDescription: "presets.items.drapeOnModel.uploaderDesc",
  },
  {
    key: "retargetPose",
    titleKey: "presets.items.retargetPose.title",
    prompt: "Make the pose of the model in Image 2 align with the reference pose in Image 1.",
    emoji: "💃",
    descriptionKey: "presets.items.retargetPose.description",
    isMultiImage: true,
    isSecondaryOptional: false,
    primaryUploaderTitle: "presets.items.retargetPose.uploader1Title",
    primaryUploaderDescription: "presets.items.retargetPose.uploader1Desc",
    secondaryUploaderTitle: "presets.items.retargetPose.uploader2Title",
    secondaryUploaderDescription: "presets.items.retargetPose.uploader2Desc",
  },
  {
    key: "recomposeScene",
    titleKey: "presets.items.recomposeScene.title",
    prompt: "Based on Image 1, erase the original character, select the character from Image 2, and replace the original character in the scene of Image 1 with the selected one. Maintain the character's pose and complete outfit and accessories. Ensure the character's depth of field matches the background, with natural shadows and soft, unified overall lighting. Avoid artificial edge glow, and coordinate the character's skin tone with the environmental color temperature.",
    emoji: "🌅",
    descriptionKey: "presets.items.recomposeScene.description",
    isMultiImage: true,
    isSecondaryOptional: false,
    primaryUploaderTitle: "presets.items.recomposeScene.uploader1Title",
    primaryUploaderDescription: "presets.items.recomposeScene.uploader1Desc",
    secondaryUploaderTitle: "presets.items.recomposeScene.uploader2Title",
    secondaryUploaderDescription: "presets.items.recomposeScene.uploader2Desc",
  },
  {
    key: "dressGivenModel",
    titleKey: "presets.items.dressGivenModel.title",
    prompt: "Replace the clothing and accessories on the character in Image 1 with all the garments and accessories from Image 2. Preserve the realistic texture, details, and lighting performance of the attire. Maintain the characteristics of the character in Image 1 to display the complete outfit and accessories from Image 2 in a coherent and fashionable manner.",
    emoji: "👭",
    descriptionKey: "presets.items.dressGivenModel.description",
    isMultiImage: true,
    isSecondaryOptional: false,

    primaryUploaderTitle: "presets.items.dressGivenModel.uploader1Title",
    primaryUploaderDescription: "presets.items.dressGivenModel.uploader1Desc",
    secondaryUploaderTitle: "presets.items.dressGivenModel.uploader2Title",
    secondaryUploaderDescription: "presets.items.dressGivenModel.uploader2Desc",
  },
  {
    key: "motionFreeform",
    titleKey: "motion.title",
    prompt: "CUSTOM",
    emoji: "🎬",
    descriptionKey: undefined,
    singleUploaderDescription: "motion.referenceImage",
    isVideo: true,
  },
  // {
  //   key: "tintFromPalette",
  //   titleKey: "presets.items.tintFromPalette.title",
  //   prompt: "Converts an image to line art, then colors it using a second image as a palette.",
  //   emoji: "🌈",
  //   descriptionKey: "presets.items.tintFromPalette.description",
  //   isMultiImage: true,
  //   isSecondaryOptional: false,
  //   isDoubleModel: true,
  //   primaryUploaderTitle: "presets.items.tintFromPalette.uploader1Title",
  //   primaryUploaderDescription: "presets.items.tintFromPalette.uploader1Desc",
  //   secondaryUploaderTitle: "presets.items.tintFromPalette.uploader2Title",
  //   secondaryUploaderDescription: "presets.items.tintFromPalette.uploader2Desc",
  // },
  // Viral & Fun (Flattened)
  // {
  //   key: "figurine",
  //   titleKey: "presets.items.figurine.title",
  //   prompt: "turn this photo into a character figure. Behind it, place a box with the character’s image printed on it, and a computer showing the Blender modeling process on its screen. In front of the box, add a round plastic base with the character figure standing on it. set the scene indoors if possible",
  //   emoji: "🧍",
  //   descriptionKey: "presets.items.figurine.description"
  // },
  // {
  //   key: "funko",
  //   titleKey: "presets.items.funko.title",
  //   prompt: "Transform the person into a Funko Pop figure, shown inside and next to its packaging.",
  //   emoji: "📦",
  //   descriptionKey: "presets.items.funko.description"
  // },
  // {
  //   key: "lego",
  //   titleKey: "presets.items.lego.title",
  //   prompt: "Transform the person into a LEGO minifigure, inside its packaging box.",
  //   emoji: "🧱",
  //   descriptionKey: "presets.items.lego.description"
  // },
  // {
  //   key: "crochet",
  //   titleKey: "presets.items.crochet.title",
  //   prompt: "Transform the subject into a handmade crocheted yarn doll with a cute, chibi-style appearance.",
  //   emoji: "🧶",
  //   descriptionKey: "presets.items.crochet.description"
  // },
  // {
  //   key: "cosplay",
  //   titleKey: "presets.items.cosplay.title",
  //   prompt: "Generate a highly detailed, realistic photo of a person cosplaying the character in this illustration. Replicate the pose, expression, and framing.",
  //   emoji: "🎭",
  //   descriptionKey: "presets.items.cosplay.description"
  // },
  // {
  //   key: "plushie",
  //   titleKey: "presets.items.plushie.title",
  //   prompt: "Turn the person in this photo into a cute, soft plushie doll.",
  //   emoji: "🧸",
  //   descriptionKey: "presets.items.plushie.description"
  // },
  // {
  //   key: "keychain",
  //   titleKey: "presets.items.keychain.title",
  //   prompt: "Turn the subject into a cute acrylic keychain, shown attached to a bag.",
  //   emoji: "🔑",
  //   descriptionKey: "presets.items.keychain.description"
  // },
  //
  // // Photo & Pro Edits (Flattened)
  //  {
  //   key: "sharpen",
  //   titleKey: "presets.items.sharpen.title",
  //   prompt: "Enhance this image to high resolution, improving sharpness and clarity.",
  //   emoji: "🔍",
  //   descriptionKey: "presets.items.sharpen.description"
  // },
  // {
  //   key: "poseRef",
  //   titleKey: "presets.items.poseRef.title",
  //   prompt: "Apply the pose from the second image to the character in the first image. Render as a professional studio photograph.",
  //   emoji: "💃",
  //   descriptionKey: "presets.items.poseRef.description",
  //   isMultiImage: true,
  //   primaryUploaderTitle: "presets.items.poseRef.uploader1Title",
  //   primaryUploaderDescription: "presets.items.poseRef.uploader1Desc",
  //   secondaryUploaderTitle: "presets.items.poseRef.uploader2Title",
  //   secondaryUploaderDescription: "presets.items.poseRef.uploader2Desc",
  // },
  // {
  //   key: "photorealistic",
  //   titleKey: "presets.items.photorealistic.title",
  //   prompt: "Turn this illustration into a photorealistic version.",
  //   emoji: "🪄",
  //   descriptionKey: "presets.items.photorealistic.description"
  // },
  // {
  //   key: "fashion",
  //   titleKey: "presets.items.fashion.title",
  //   prompt: "Transform the photo into a stylized, ultra-realistic fashion magazine portrait with cinematic lighting.",
  //   emoji: "📸",
  //   descriptionKey: "presets.items.fashion.description"
  // },
  // {
  //   key: "hyperrealistic",
  //   titleKey: "presets.items.hyperrealistic.title",
  //   prompt: "Generate a hyper-realistic, fashion-style photo with strong, direct flash lighting, grainy texture, and a cool, confident pose.",
  //   emoji: "✨",
  //   descriptionKey: "presets.items.hyperrealistic.description"
  // },
  //
  // // Design & Product (Flattened)
  //  {
  //   key: "architecture",
  //   titleKey: "presets.items.architecture.title",
  //   prompt: "Convert this photo of a building into a miniature architecture model, placed on a cardstock in an indoor setting. Show a computer with modeling software in the background.",
  //   emoji: "🏗️",
  //   descriptionKey: "presets.items.architecture.description"
  // },
  // {
  //   key: "productRender",
  //   titleKey: "presets.items.productRender.title",
  //   prompt: "Turn this product sketch into a photorealistic 3D render with studio lighting.",
  //   emoji: "💡",
  //   descriptionKey: "presets.items.productRender.description"
  // },
  // {
  //   key: "sodaCan",
  //   titleKey: "presets.items.sodaCan.title",
  //   prompt: "Design a soda can using this image as the main graphic, and show it in a professional product shot.",
  //   emoji: "🥤",
  //   descriptionKey: "presets.items.sodaCan.description"
  // },
  // {
  //   key: "industrialDesign",
  //   titleKey: "presets.items.industrialDesign.title",
  //   prompt: "Turn this industrial design sketch into a realistic product photo, rendered with light brown leather and displayed in a minimalist museum setting.",
  //   emoji: "🛋️",
  //   descriptionKey: "presets.items.industrialDesign.description"
  // },
  // {
  //   key: "iphoneWallpaper",
  //   titleKey: "presets.items.iphoneWallpaper.title",
  //   prompt: "Turn the image into an iPhone lock screen wallpaper effect, with the phone's time (01:16), date (Sunday, September 16), and status bar information (battery, signal, etc.), with the flashlight and camera buttons at the bottom, overlaid on the image. The original image should be adapted to a vertical composition that fits a phone screen. The phone is placed on a solid color background of the same color scheme.",
  //   emoji: "📱",
  //   descriptionKey: "presets.items.iphoneWallpaper.description"
];
