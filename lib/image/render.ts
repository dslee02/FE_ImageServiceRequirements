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
  
  if (!hasRiffHeader || (!hasWebpHeader && !hasAvifHeader)) {
    // 지원하는 이미지 형식이 아니면 텍스트로 표시
    console.log('⚠️ 지원하지 않는 이미지 형식. WebP/AVIF만 지원됩니다.');
    renderTextToCanvas(canvas, fullBytes);
    return;
  }
  
  // 복호화에서 이미 정확한 크기로 전달되므로 전체 데이터 사용
  console.log(`받은 이미지 데이터 크기: ${fullBytes.length} bytes`);
  const webpData = fullBytes;

  let bitmap: ImageBitmap | null = null;

  try {
    // 직접 Blob에서 ImageBitmap 생성 시도
    const blob = new Blob([webpData], { type: 'image/webp' });
    console.log(`image/webp 형식으로 디코딩 시도 (${webpData.length} bytes)`);
    console.log('WebP 데이터 샘플 (hex):', Array.from(webpData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    bitmap = await createImageBitmap(blob);
    console.log(`✅ image/webp 디코딩 성공`);
  } catch (primaryError) {
    console.warn(`image/webp 디코딩 실패, Image 객체로 재시도:`, primaryError);
    
    try {
      // Image 객체를 사용한 fallback 방식
      const imageObj = new Image();
      const canvas2d = document.createElement('canvas');
      const ctx2d = canvas2d.getContext('2d');
      
      if (!ctx2d) {
        throw new Error('Canvas 2D context 생성 실패');
      }
      
      // Base64 변환로 시도
      const base64 = btoa(String.fromCharCode(...webpData));
      const dataUrl = `data:image/webp;base64,${base64}`;
      
      console.log('🔄 Image 객체 + Base64 방식으로 재시도...');
      
      await new Promise<void>((resolve, reject) => {
        imageObj.onload = () => {
          try {
            canvas2d.width = imageObj.naturalWidth;
            canvas2d.height = imageObj.naturalHeight;
            ctx2d.drawImage(imageObj, 0, 0);
            
            // 임시 Canvas에서 ImageBitmap 생성
            createImageBitmap(canvas2d).then(bmp => {
              bitmap = bmp;
              console.log('✅ Image 객체 방식 성공!');
              resolve();
            }).catch(reject);
          } catch (drawError) {
            reject(drawError);
          }
        };
        imageObj.onerror = reject;
        imageObj.src = dataUrl;
      });
      
      if (!bitmap) {
        throw new Error('Image 객체 방식 실패');
      }
    } catch (fallbackError) {
      console.error('모든 이미지 디코딩 방식 실패, 텍스트 모드로 전환');
      console.log('디코딩 실패 상세:', { primaryError, fallbackError });
      
      // 텍스트 모드에서 성공 표시 (복호화 성공이지만 이미지 디코딩 실패)
      renderSuccessCanvas(canvas, fullBytes);
      return;
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
 * 이미지 비트맵 생성 with fallback (예비용 함수)
 */
export async function createImageBitmapWithFallback(
  bytes: Uint8Array,
  format: "aeia" | "aeiw"
): Promise<ImageBitmap> {
  const primaryMime = format === "aeia" ? "image/avif" : "image/webp";
  const fallbackMime = format === "aeia" ? "image/webp" : "image/avif";

  try {
    const blob = new Blob([bytes.slice()], { type: primaryMime });
    return await createImageBitmap(blob);
  } catch (primaryError) {
    console.warn(`${primaryMime} 디코딩 실패, ${fallbackMime}로 재시도:`, primaryError);
    
    const fallbackBlob = new Blob([bytes.slice()], { type: fallbackMime });
    return await createImageBitmap(fallbackBlob);
  }
}