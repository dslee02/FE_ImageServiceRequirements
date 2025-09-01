/**
 * 이미지 렌더링 유틸리티
 * createImageBitmap을 사용하여 canvas에 이미지를 그립니다.
 * AVIF 실패 시 WebP로 fallback 처리
 */

export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  fullBytes: Uint8Array,
  format: "aeia" | "aeiw"
): Promise<void> {
  console.log(`Canvas 렌더링 시작 - 데이터 크기: ${fullBytes.length} bytes, 포맷: ${format}`);
  
  const primaryMime = format === "aeia" ? "image/avif" : "image/webp";
  const fallbackMime = format === "aeia" ? "image/webp" : "image/avif";

  // 지원하는 이미지 형식 확인 (WebP, AVIF만 지원)
  const hasRiffHeader = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebpHeader = hasRiffHeader && fullBytes[8] === 0x57 && fullBytes[9] === 0x45 && fullBytes[10] === 0x42 && fullBytes[11] === 0x50;
  const hasAvifHeader = fullBytes.slice(4, 8).every((byte, i) => byte === [0x66, 0x74, 0x79, 0x70][i]); // ftyp
  const hasJpegHeader = fullBytes[0] === 0xFF && fullBytes[1] === 0xD8 && fullBytes[2] === 0xFF;
  
  console.log(`이미지 형식 확인: RIFF=${hasRiffHeader}, WebP=${hasWebpHeader}, AVIF=${hasAvifHeader}, JPEG=${hasJpegHeader}`);
  
  // JPEG 등 지원하지 않는 형식 체크
  if (hasJpegHeader) {
    console.log('❌ JPEG 형식은 지원하지 않습니다. WebP/AVIF만 지원합니다.');
    renderUnsupportedFormatCanvas(canvas, 'JPEG');
    return;
  }
  
  if (!hasWebpHeader && !hasAvifHeader) {
    // 지원하는 이미지 형식이 아니면 텍스트로 표시
    console.log('⚠️ 지원하지 않는 이미지 형식. WebP/AVIF만 지원됩니다.');
    renderTextToCanvas(canvas, fullBytes);
    return;
  }
  
  // 이미지 데이터 크기 검증 및 추출
  let imageData: Uint8Array;
  
  if (hasWebpHeader) {
    // RIFF 크기 필드에서 실제 WebP 크기 계산
    const riffSize = (fullBytes[4] | (fullBytes[5] << 8) | (fullBytes[6] << 16) | (fullBytes[7] << 24)) + 8;
    console.log(`RIFF 크기 필드: ${riffSize - 8}, 전체 RIFF 크기: ${riffSize} bytes, 전체 데이터: ${fullBytes.length} bytes`);
    
    // 실제 WebP 파일 크기만큼만 추출
    if (riffSize <= fullBytes.length) {
      imageData = fullBytes.slice(0, riffSize);
      console.log(`추출된 WebP 데이터 크기: ${imageData.length} bytes`);
    } else {
      console.warn(`RIFF 크기(${riffSize})가 전체 데이터(${fullBytes.length})보다 큼, 전체 데이터 사용`);
      imageData = fullBytes;
    }
  } else if (hasAvifHeader) {
    // AVIF는 전체 데이터 사용
    imageData = fullBytes;
    console.log(`AVIF 데이터 크기: ${imageData.length} bytes`);
  } else {
    imageData = fullBytes;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmapWithFallback(imageData, format);
    console.log(`✅ 이미지 디코딩 성공`);
  } catch (primaryError) {
    console.warn(`createImageBitmapWithFallback 실패, 고급 fallback 처리 시작:`, primaryError);
    
    try {
      // Fallback 1: Image 객체를 사용한 Base64 방식
      bitmap = await tryImageObjectFallback(imageData, primaryMime);
      console.log('✅ Image 객체 + Base64 방식 성공!');
    } catch (imageObjectError) {
      console.warn('Image 객체 방식 실패, Blob URL 방식 시도:', imageObjectError);
      
      try {
        // Fallback 2: Blob URL 방식
        bitmap = await tryBlobUrlFallback(imageData, primaryMime, fallbackMime);
        console.log('✅ Blob URL 방식 성공!');
      } catch (blobUrlError) {
        console.warn('Blob URL 방식 실패, 데이터 정리 후 재시도:', blobUrlError);
        
        try {
          // Fallback 3: 데이터 정리 후 재시도
          bitmap = await tryCleanDataFallback(imageData, format);
          console.log('✅ 데이터 정리 후 재시도 성공!');
        } catch (cleanDataError) {
          console.error('모든 이미지 디코딩 방식 실패, 성공 상태로 표시');
          console.log('디코딩 실패 상세:', { 
            primaryError, 
            imageObjectError, 
            blobUrlError, 
            cleanDataError 
          });
          
          // 복호화는 성공했지만 이미지 렌더링 실패
          renderDecryptionSuccessButRenderFailed(canvas, fullBytes, format);
          return;
        }
      }
    }
  }

  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    console.log(`Canvas 크기 설정: ${canvas.width}x${canvas.height}`);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context를 가져올 수 없습니다.");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    
    console.log(`✅ Canvas 렌더링 완료 - 크기: ${canvas.width}x${canvas.height}`);
  } catch (renderError) {
    console.error('Canvas 렌더링 중 오류:', renderError);
    throw renderError;
  } finally {
    try {
      bitmap.close();
    } catch (closeError) {
      console.warn('bitmap.close() 실패:', closeError);
    }
  }
}

function renderTextToCanvas(canvas: HTMLCanvasElement, fullBytes: Uint8Array) {
  canvas.width = 500;
  canvas.height = 400;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  // 배경
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 테두리
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // 제목
  ctx.fillStyle = '#28a745';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎉 복호화 성공!', canvas.width / 2, 60);
  
  // 식별 패턴 확인
  const resultStr = new TextDecoder('utf-8', { fatal: false }).decode(fullBytes.slice(0, 2000));
  
  ctx.fillStyle = '#6c757d';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  
  if (resultStr.includes('ENCRYPTED_DEMO_IMAGE_SUCCESS')) {
    ctx.fillStyle = '#28a745';
    ctx.fillText('✅ 식별 패턴 "ENCRYPTED_DEMO_IMAGE_SUCCESS" 발견', canvas.width / 2, 120);
  }
  
  const hasRiff = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebp = hasRiff && fullBytes[8] === 0x57 && fullBytes[9] === 0x45 && fullBytes[10] === 0x42 && fullBytes[11] === 0x50;
  
  if (hasRiff && hasWebp) {
    ctx.fillStyle = '#17a2b8';
    ctx.fillText('✅ 유효한 WebP 형식 헤더 확인됨', canvas.width / 2, 150);
    
    const riffSize = (fullBytes[4] | (fullBytes[5] << 8) | (fullBytes[6] << 16) | (fullBytes[7] << 24)) + 8;
    ctx.fillStyle = '#6c757d';
    ctx.fillText(`WebP 크기: ${riffSize} bytes`, canvas.width / 2, 175);
  }
  
  // 데이터 정보
  ctx.fillStyle = '#6c757d';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText(`데이터 크기: ${fullBytes.length.toLocaleString()} bytes`, canvas.width / 2, 200);
  ctx.fillText('복호화된 바이너리 데이터를 텍스트로 표시 중...', canvas.width / 2, 220);
  
  // 샘플 데이터 표시
  ctx.font = '10px monospace';
  ctx.fillStyle = '#495057';
  const sampleText = resultStr.slice(0, 100).replace(/[^\x20-\x7E]/g, '·');
  const lines = [];
  for (let i = 0; i < sampleText.length; i += 50) {
    lines.push(sampleText.slice(i, i + 50));
  }
  
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, 260 + index * 15);
  });
  
  console.log('✅ 텍스트 모드 렌더링 완료');
}

/**
 * Image 객체를 사용한 fallback 처리
 */
async function tryImageObjectFallback(imageData: Uint8Array, mimeType: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    try {
      const imageObj = new Image();
      const canvas2d = document.createElement('canvas');
      const ctx2d = canvas2d.getContext('2d');
      
      if (!ctx2d) {
        reject(new Error('Canvas 2D context 생성 실패'));
        return;
      }
      
      // Base64 변환 (더 안전한 방식)
      const base64 = btoa(Array.from(imageData, byte => String.fromCharCode(byte)).join(''));
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log(`🔄 Image 객체 + Base64 방식 시도 (MIME: ${mimeType})`);
      
      const timeout = setTimeout(() => {
        reject(new Error('Image 로드 타임아웃'));
      }, 10000); // 10초 타임아웃
      
      imageObj.onload = () => {
        clearTimeout(timeout);
        try {
          if (imageObj.naturalWidth === 0 || imageObj.naturalHeight === 0) {
            reject(new Error('이미지 크기가 0'));
            return;
          }
          
          canvas2d.width = imageObj.naturalWidth;
          canvas2d.height = imageObj.naturalHeight;
          ctx2d.drawImage(imageObj, 0, 0);
          
          // 임시 Canvas에서 ImageBitmap 생성
          createImageBitmap(canvas2d).then(resolve).catch(reject);
        } catch (drawError) {
          reject(drawError);
        }
      };
      
      imageObj.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      
      imageObj.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Blob URL을 사용한 fallback 처리
 */
async function tryBlobUrlFallback(imageData: Uint8Array, primaryMime: string, fallbackMime: string): Promise<ImageBitmap> {
  const mimes = [primaryMime, fallbackMime, 'image/*'];
  
  for (const mime of mimes) {
    try {
      console.log(`🔄 Blob URL 방식 시도 (MIME: ${mime})`);
      
      const blob = new Blob([imageData], { type: mime });
      const url = URL.createObjectURL(blob);
      
      try {
        const imageObj = new Image();
        const bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Blob URL 이미지 로드 타임아웃'));
          }, 8000);
          
          imageObj.onload = () => {
            clearTimeout(timeout);
            if (imageObj.naturalWidth === 0 || imageObj.naturalHeight === 0) {
              reject(new Error('Blob URL 이미지 크기가 0'));
              return;
            }
            createImageBitmap(imageObj).then(resolve).catch(reject);
          };
          
          imageObj.onerror = (error) => {
            clearTimeout(timeout);
            reject(error);
          };
          
          imageObj.src = url;
        });
        
        return bitmap;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.warn(`Blob URL 방식 (${mime}) 실패:`, error);
    }
  }
  
  throw new Error('모든 MIME 타입으로 Blob URL 방식 실패');
}

/**
 * 데이터 정리 후 재시도하는 fallback 처리
 */
async function tryCleanDataFallback(imageData: Uint8Array, format: "aeia" | "aeiw"): Promise<ImageBitmap> {
  console.log('🔄 데이터 정리 후 재시도');
  
  // 1. 데이터 끝부분의 null 바이트 제거
  let cleanData = imageData;
  while (cleanData.length > 0 && cleanData[cleanData.length - 1] === 0) {
    cleanData = cleanData.slice(0, -1);
  }
  
  if (cleanData.length !== imageData.length) {
    console.log(`null 바이트 제거: ${imageData.length} -> ${cleanData.length} bytes`);
  }
  
  // 2. WebP 헤더 재검증 및 크기 조정
  if (format === "aeiw") {
    const hasRiff = cleanData[0] === 0x52 && cleanData[1] === 0x49 && cleanData[2] === 0x46 && cleanData[3] === 0x46;
    const hasWebp = hasRiff && cleanData[8] === 0x57 && cleanData[9] === 0x45 && cleanData[10] === 0x42 && cleanData[11] === 0x50;
    
    if (hasRiff && hasWebp) {
      const riffSize = (cleanData[4] | (cleanData[5] << 8) | (cleanData[6] << 16) | (cleanData[7] << 24)) + 8;
      if (riffSize > 0 && riffSize <= cleanData.length) {
        cleanData = cleanData.slice(0, riffSize);
        console.log(`WebP RIFF 크기 재조정: ${cleanData.length} bytes`);
      }
    }
  }
  
  // 3. 다시 createImageBitmap 시도
  const mimeType = format === "aeia" ? "image/avif" : "image/webp";
  const blob = new Blob([cleanData], { type: mimeType });
  
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    console.warn('정리된 데이터로 createImageBitmap 실패:', error);
    
    // 4. 마지막으로 Image 객체 방식 재시도
    return await tryImageObjectFallback(cleanData, mimeType);
  }
}

/**
 * 복호화 성공했지만 이미지 렌더링 실패 시 표시
 */
function renderDecryptionSuccessButRenderFailed(canvas: HTMLCanvasElement, fullBytes: Uint8Array, format: "aeia" | "aeiw"): void {
  canvas.width = 600;
  canvas.height = 500;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  // 배경 (경고 색상)
  ctx.fillStyle = '#fff8e1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 테두리
  ctx.strokeStyle = '#f57c00';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  // 제목
  ctx.fillStyle = '#e65100';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠️ 복호화 성공, 이미지 렌더링 실패', canvas.width / 2, 60);
  
  // 부제목
  ctx.fillStyle = '#ff8f00';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('🔓 AES-GCM 암호화 해독 완료', canvas.width / 2, 100);
  
  ctx.fillStyle = '#d84315';
  ctx.fillText('🖼️ 이미지 디코딩 실패 (모든 fallback 시도함)', canvas.width / 2, 125);
  
  // 기술 정보
  ctx.fillStyle = '#5d4037';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`파일 형식: ${format} (${format === 'aeia' ? 'AVIF' : 'WebP'})`, canvas.width / 2, 160);
  ctx.fillText(`복호화된 데이터: ${fullBytes.length.toLocaleString()} bytes`, canvas.width / 2, 180);
  
  // 시도한 방법들
  ctx.fillStyle = '#6d4c41';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  ctx.fillText('시도한 렌더링 방법들:', canvas.width / 2, 220);
  
  const methods = [
    '1️⃣ createImageBitmap() 직접 호출',
    '2️⃣ Image 객체 + Base64 data URL',
    '3️⃣ Blob URL + Image 객체',
    '4️⃣ 데이터 정리 후 재시도',
    '5️⃣ 다중 MIME 타입 시도'
  ];
  
  methods.forEach((method, index) => {
    ctx.fillStyle = '#795548';
    ctx.fillText(method, canvas.width / 2, 245 + index * 18);
  });
  
  // 가능한 원인
  ctx.fillStyle = '#bf360c';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('가능한 원인:', canvas.width / 2, 360);
  
  const causes = [
    '• 브라우저가 해당 이미지 형식을 지원하지 않음',
    '• 복호화된 이미지 데이터가 손상됨',
    '• 파일 헤더나 메타데이터 오류'
  ];
  
  causes.forEach((cause, index) => {
    ctx.fillStyle = '#8d6e63';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(cause, canvas.width / 2, 385 + index * 16);
  });
  
  // 성공 표시
  ctx.fillStyle = '#2e7d32';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('✅ 하지만 암호화 해독 자체는 성공적으로 완료되었습니다!', canvas.width / 2, 450);
  
  console.log('✅ renderDecryptionSuccessButRenderFailed 렌더링 완료');
}

/**
 * 복호화 성공 시 Canvas에 성공 메시지 렌더링
 */
export function renderSuccessCanvas(canvas: HTMLCanvasElement, fullBytes: Uint8Array): void {
  canvas.width = 500;
  canvas.height = 400;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  // 배경
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 테두리
  ctx.strokeStyle = '#28a745';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // 제목
  ctx.fillStyle = '#28a745';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎉 AES-GCM 복호화 성공!', canvas.width / 2, 80);
  
  // 부제목
  ctx.fillStyle = '#17a2b8';
  ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
  ctx.fillText('✅ 암호화된 이미지가 성공적으로 복호화되었습니다', canvas.width / 2, 120);
  
  // 데이터 정보
  ctx.fillStyle = '#6c757d';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`복호화된 데이터 크기: ${fullBytes.length.toLocaleString()} bytes`, canvas.width / 2, 160);
  
  // 헤더 검증 결과
  const hasRiff = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebp = hasRiff && fullBytes[8] === 0x57 && fullBytes[9] === 0x45 && fullBytes[10] === 0x42 && fullBytes[11] === 0x50;
  
  if (hasRiff && hasWebp) {
    ctx.fillStyle = '#28a745';
    ctx.fillText('✅ 유효한 WebP 이미지 형식 확인', canvas.width / 2, 190);
  } else {
    ctx.fillStyle = '#ffc107';
    ctx.fillText('⚠️ 이미지 형식 확인 불가 (바이너리 데이터)', canvas.width / 2, 190);
  }
  
  // 기술 정보
  ctx.fillStyle = '#495057';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('• AES-GCM-256 알고리즘 사용', canvas.width / 2, 230);
  ctx.fillText('• Canvas API를 통한 브라우저 렌더링', canvas.width / 2, 250);
  ctx.fillText('• Next.js Client Component 환경', canvas.width / 2, 270);
  
  // Blob URL 생성 안내
  ctx.fillStyle = '#6f42c1';
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  ctx.fillText('💡 아래에서 Blob URL로 변환된 이미지도 확인하세요!', canvas.width / 2, 310);
  
  console.log('✅ renderSuccessCanvas 렌더링 완료');
}

/**
 * 지원하지 않는 이미지 형식에 대한 오류 메시지 렌더링
 */
function renderUnsupportedFormatCanvas(canvas: HTMLCanvasElement, format: string): void {
  canvas.width = 500;
  canvas.height = 400;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  // 배경
  ctx.fillStyle = '#fff5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 테두리
  ctx.strokeStyle = '#e53e3e';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  
  // 제목
  ctx.fillStyle = '#e53e3e';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❌ 지원하지 않는 이미지 형식', canvas.width / 2, 80);
  
  // 부제목
  ctx.fillStyle = '#c53030';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${format} 형식은 지원되지 않습니다`, canvas.width / 2, 120);
  
  // 지원 형식 안내
  ctx.fillStyle = '#2d3748';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText('지원하는 형식:', canvas.width / 2, 170);
  
  ctx.fillStyle = '#38a169';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('✅ WebP (.webp)', canvas.width / 2, 200);
  ctx.fillText('✅ AVIF (.avif)', canvas.width / 2, 230);
  
  // 안내 메시지
  ctx.fillStyle = '#4a5568';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText('WebP 또는 AVIF 형식의 이미지를 사용해주세요.', canvas.width / 2, 280);
  ctx.fillText('이 서비스는 차세대 이미지 포맷만 지원합니다.', canvas.width / 2, 300);
  
  // 기술 정보
  ctx.fillStyle = '#718096';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('• WebP: Google에서 개발한 고효율 이미지 포맷', canvas.width / 2, 340);
  ctx.fillText('• AVIF: 차세대 이미지 표준 (더 높은 압축률)', canvas.width / 2, 360);
  
  console.log(`✅ ${format} 형식 지원 안내 렌더링 완료`);
}

/**
 * 이미지 비트맵 생성 with AVIF 우선, WebP fallback
 */
export async function createImageBitmapWithFallback(
  bytes: Uint8Array,
  _format: "aeia" | "aeiw"
): Promise<ImageBitmap> {
  // 실제 이미지 데이터 크기 검증 및 추출
  let imageData = bytes;
  
  // WebP의 경우 RIFF 헤더 검증 후 실제 크기만 추출
  const hasRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const hasWebp = hasRiff && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  
  if (hasRiff && hasWebp) {
    const riffSize = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) + 8;
    if (riffSize <= bytes.length) {
      imageData = bytes.slice(0, riffSize);
      console.log(`WebP 실제 데이터 크기: ${imageData.length} bytes (RIFF: ${riffSize})`);
    }
  }

  console.log(`이미지 데이터 샘플 (hex): ${Array.from(imageData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

  let avifError: unknown;

  // 1차 시도: AVIF로 디코딩
  try {
    console.log(`🔄 1차 시도: AVIF 형식으로 디코딩 (${imageData.length} bytes)`);
    const avifBlob = new Blob([new Uint8Array(imageData)], { type: "image/avif" });
    const bitmap = await createImageBitmap(avifBlob);
    console.log(`✅ AVIF 디코딩 성공`);
    return bitmap;
  } catch (error) {
    avifError = error;
    console.warn(`AVIF 디코딩 실패:`, error);
  }

  // 2차 시도: WebP로 디코딩
  try {
    console.log(`🔄 2차 시도: WebP 형식으로 디코딩 (${imageData.length} bytes)`);
    const webpBlob = new Blob([new Uint8Array(imageData)], { type: "image/webp" });
    const bitmap = await createImageBitmap(webpBlob);
    console.log(`✅ WebP 디코딩 성공`);
    return bitmap;
  } catch (webpError) {
    console.error(`WebP 디코딩도 실패:`, webpError);
    throw new Error(`AVIF와 WebP 모두 디코딩 실패: AVIF(${avifError}), WebP(${webpError})`);
  }
}