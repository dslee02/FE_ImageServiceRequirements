/**
 * 이미지 메타데이터 및 브라우저 지원 감지 유틸리티
 */

export interface ImageMetadata {
  dpr: number;
  cssWidth: number;
  physicalWidth: number;
  avifSupported: boolean;
}

export async function getImageMeta(
  element: HTMLElement | React.RefObject<HTMLElement>
): Promise<ImageMetadata> {
  const target = 'current' in element ? element.current : element;
  
  if (!target) {
    return {
      dpr: 1,
      cssWidth: 0,
      physicalWidth: 0,
      avifSupported: false,
    };
  }

  const dpr = window.devicePixelRatio ?? 1;
  const rect = target.getBoundingClientRect();
  const cssWidth = rect.width;
  const physicalWidth = Math.round(cssWidth * dpr);
  const avifSupported = await supportsAvif();
  
  return { dpr, cssWidth, physicalWidth, avifSupported };
}

export async function supportsAvif(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  console.log('🔍 AVIF 지원 여부 확인 시작');
  
  // 1차: createImageBitmap으로 AVIF 테스트 (가장 확실한 방법)
  try {
    // 1x1 픽셀 AVIF 이미지 (최소 크기)
    const minimalAvif = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
      0x61, 0x76, 0x69, 0x66, 0x6D, 0x69, 0x66, 0x31, 0x6D, 0x69, 0x61, 0x66, 0x4D, 0x41, 0x31, 0x42,
      0x00, 0x00, 0x00, 0x28, 0x6D, 0x65, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21,
      0x68, 0x64, 0x6C, 0x72, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x70, 0x69, 0x63, 0x74
    ]);
    
    const blob = new Blob([minimalAvif], { type: 'image/avif' });
    await createImageBitmap(blob);
    console.log('✅ createImageBitmap AVIF 테스트 성공');
    return true;
  } catch (error) {
    console.log('❌ createImageBitmap AVIF 테스트 실패:', error);
  }
  
  // 2차: Image 요소로 AVIF 데이터 URL 테스트
  return new Promise((resolve) => {
    console.log('🔄 Image 요소로 AVIF 테스트 시도');
    
    // 더 작은 AVIF 데이터 URL (1x1 흰색 픽셀)
    const avifData = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    
    const img = new Image();
    
    const timeout = setTimeout(() => {
      console.log('⏰ AVIF 테스트 타임아웃 (3초)');
      resolve(false);
    }, 3000);
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log('✅ Image 요소 AVIF 테스트 성공');
      resolve(true);
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.log('❌ Image 요소 AVIF 테스트 실패:', error);
      resolve(false);
    };
    
    img.src = avifData;
  });
}

export function generateImageUrl(
  baseUrl: string,
  contentId: string,
  options: {
    width?: number;
    avifSupported: boolean;
    encrypted?: boolean;
  }
): string {
  const { width, avifSupported, encrypted = false } = options;
  const format = avifSupported ? 'avif' : 'webp';
  const extension = encrypted ? (avifSupported ? 'aeia' : 'aeiw') : format;
  
  let url = `${baseUrl}/content/${contentId}.${extension}`;
  
  if (width) {
    url += `?width=${width}`;
  }
  
  return url;
}

export function getOptimalWidth(cssWidth: number, dpr: number): number {
  const physicalWidth = Math.round(cssWidth * dpr);
  
  // 128의 배수 프리셋 목록
  const presets = [128, 256, 384, 512, 640, 768, 896, 1024, 1152, 1280, 1536, 1920, 2048, 2560, 3072, 3840, 4096];
  
  // 물리적 너비보다 크거나 같은 가장 작은 프리셋 선택
  return presets.find(preset => preset >= physicalWidth) ?? presets[presets.length - 1];
}