# 🛠️ 암호화 이미지 프로젝트 구현 단계별 가이드

이 문서는 암호화된 이미지 처리 시스템을 단계별로 구현하는 상세한 가이드입니다.

## 📋 구현 순서

1. [기본 환경 설정](#1-기본-환경-설정)
2. [파일 파싱 로직 구현](#2-파일-파싱-로직-구현)
3. [암호화/복호화 로직 구현](#3-암호화복호화-로직-구현)
4. [이미지 렌더링 로직 구현](#4-이미지-렌더링-로직-구현)
5. [React 컴포넌트 구현](#5-react-컴포넌트-구현)
6. [캐싱 시스템 구현](#6-캐싱-시스템-구현)
7. [UI 및 사용자 경험 개선](#7-ui-및-사용자-경험-개선)
8. [테스트 및 디버깅](#8-테스트-및-디버깅)

---

## 1. 기본 환경 설정

### 1.1 Next.js 프로젝트 생성

```bash
# Next.js 프로젝트 생성
npx create-next-app@latest encrypted-image-poc --typescript --tailwind --eslint --app

# 프로젝트 디렉토리로 이동
cd encrypted-image-poc

# 개발 서버 시작
npm run dev
```

### 1.2 프로젝트 구조 설정

```bash
# 디렉토리 생성
mkdir -p lib/crypto lib/image lib/cache components scripts public

# 기본 파일 생성
touch lib/crypto/parse.ts
touch lib/crypto/decrypt.ts  
touch lib/image/render.ts
touch lib/image/metadata.ts
touch lib/cache/store.ts
touch components/EncryptedImage.tsx
```

### 1.3 tsconfig.json 설정

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es6", "crypto"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 2. 파일 파싱 로직 구현

### 2.1 파일 형식 정의

```typescript
// lib/crypto/parse.ts

/**
 * 암호화된 이미지 파일 구조
 * [4B: magic] + [12B: IV] + [1MB: cipher] + [16B: tag] + [나머지: tail]
 */
export interface ParsedAe {
  format: "aeia" | "aeiw";    // AVIF 또는 WebP
  iv: Uint8Array;             // 12바이트 초기화 벡터
  cipher: Uint8Array;         // 1MB 암호화된 데이터
  tag: Uint8Array;            // 16바이트 인증 태그
  tail: Uint8Array;           // 나머지 평문 데이터
}

// 상수 정의
export const MAGIC_SIZE = 4;
export const IV_SIZE = 12;
export const CIPHER_SIZE = 1048576; // 1MB
export const TAG_SIZE = 16;
export const HEADER_SIZE = MAGIC_SIZE + IV_SIZE + CIPHER_SIZE + TAG_SIZE;
```

### 2.2 파싱 함수 구현

```typescript
// lib/crypto/parse.ts (계속)

export function parseAe(fileData: Uint8Array): ParsedAe {
  console.log(`파일 파싱 시작 - 총 크기: ${fileData.length} bytes`);

  // 최소 크기 검증
  if (fileData.length < HEADER_SIZE) {
    throw new Error(
      `파일이 너무 작습니다. 최소 ${HEADER_SIZE}bytes 필요, 현재: ${fileData.length}bytes`
    );
  }

  // Magic 바이트 추출 및 검증
  const magicBytes = fileData.slice(0, MAGIC_SIZE);
  const magic = new TextDecoder().decode(magicBytes);
  
  if (magic !== "aeia" && magic !== "aeiw") {
    throw new Error(
      `지원하지 않는 파일 형식: "${magic}". "aeia" 또는 "aeiw"만 지원합니다.`
    );
  }

  console.log(`✅ Magic 확인: ${magic}`);

  // 각 섹션 추출
  let offset = MAGIC_SIZE;
  
  const iv = fileData.slice(offset, offset + IV_SIZE);
  offset += IV_SIZE;
  
  const cipher = fileData.slice(offset, offset + CIPHER_SIZE);
  offset += CIPHER_SIZE;
  
  const tag = fileData.slice(offset, offset + TAG_SIZE);
  offset += TAG_SIZE;
  
  const tail = fileData.slice(offset);

  // 크기 검증
  console.log(`📊 파싱 결과:
    - Format: ${magic}
    - IV: ${iv.length} bytes
    - Cipher: ${cipher.length} bytes  
    - Tag: ${tag.length} bytes
    - Tail: ${tail.length} bytes`);

  if (iv.length !== IV_SIZE) {
    throw new Error(`IV 크기 오류: 예상 ${IV_SIZE}, 실제 ${iv.length}`);
  }
  
  if (cipher.length !== CIPHER_SIZE) {
    throw new Error(`Cipher 크기 오류: 예상 ${CIPHER_SIZE}, 실제 ${cipher.length}`);
  }
  
  if (tag.length !== TAG_SIZE) {
    throw new Error(`Tag 크기 오류: 예상 ${TAG_SIZE}, 실제 ${tag.length}`);
  }

  return {
    format: magic as "aeia" | "aeiw",
    iv,
    cipher,
    tag,
    tail
  };
}
```

### 2.3 유틸리티 함수 추가

```typescript
// lib/crypto/parse.ts (계속)

/**
 * 바이너리 데이터를 Hex 문자열로 변환 (디버깅용)
 */
export function bytesToHex(bytes: Uint8Array, maxLength = 32): string {
  const sample = bytes.slice(0, maxLength);
  return Array.from(sample)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/**
 * 파일이 유효한 암호화 이미지인지 빠르게 검증
 */
export function isValidEncryptedImage(fileData: Uint8Array): boolean {
  if (fileData.length < MAGIC_SIZE) return false;
  
  const magic = new TextDecoder().decode(fileData.slice(0, MAGIC_SIZE));
  return magic === "aeia" || magic === "aeiw";
}
```

---

## 3. 암호화/복호화 로직 구현

### 3.1 복호화 함수 구현

```typescript
// lib/crypto/decrypt.ts

/**
 * Hex 문자열을 Uint8Array로 변환
 */
function hexToBytes(hex: string): Uint8Array {
  // 공백 제거 및 소문자 변환
  const cleanHex = hex.replace(/\s+/g, '').toLowerCase();
  
  // 홀수 길이 체크
  if (cleanHex.length % 2 !== 0) {
    throw new Error(`잘못된 Hex 형식: 길이가 홀수입니다 (${cleanHex.length})`);
  }
  
  // Hex 문자 검증
  if (!/^[0-9a-f]*$/.test(cleanHex)) {
    throw new Error('잘못된 Hex 형식: 허용되지 않는 문자가 포함되어 있습니다');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return bytes;
}

/**
 * AES-GCM 복호화 함수
 */
export async function decryptHeadAESGCM(
  iv: Uint8Array,
  cipher: Uint8Array,
  tag: Uint8Array,  
  keyHex: string
): Promise<Uint8Array> {
  console.log(`🔐 AES-GCM 복호화 시작`);
  console.log(`   - IV: ${iv.length} bytes`);
  console.log(`   - Cipher: ${cipher.length} bytes`);
  console.log(`   - Tag: ${tag.length} bytes`);
  console.log(`   - Key: ${keyHex.length} chars`);

  try {
    // 1. 키 검증 및 변환
    if (keyHex.length !== 64) {
      throw new Error(`AES-256 키는 64자리 Hex여야 합니다. 현재: ${keyHex.length}자리`);
    }
    
    const keyBuffer = hexToBytes(keyHex);
    console.log(`✅ 키 변환 완료: ${keyBuffer.length} bytes`);

    // 2. Web Crypto API로 CryptoKey 생성
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    console.log(`✅ CryptoKey 생성 완료`);

    // 3. 암호화된 데이터 준비 (cipher + tag 결합)
    const encryptedData = new Uint8Array(cipher.length + tag.length);
    encryptedData.set(cipher, 0);
    encryptedData.set(tag, cipher.length);
    console.log(`✅ 암호화 데이터 준비 완료: ${encryptedData.length} bytes`);

    // 4. 복호화 실행
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128  // 16 bytes * 8 bits = 128 bits
      },
      cryptoKey,
      encryptedData
    );

    const result = new Uint8Array(decrypted);
    console.log(`✅ 복호화 성공: ${result.length} bytes`);
    
    // 복호화된 데이터 샘플 출력 (디버깅)
    if (result.length > 0) {
      const sample = Array.from(result.slice(0, 32))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`   복호화 데이터 샘플: ${sample}`);
    }

    return result;

  } catch (error) {
    console.error(`❌ 복호화 실패:`, error);
    
    if (error instanceof Error) {
      // 구체적인 에러 메시지 제공
      if (error.name === 'OperationError') {
        throw new Error('복호화 실패: 잘못된 키이거나 데이터가 손상되었습니다');
      } else if (error.name === 'InvalidAccessError') {
        throw new Error('복호화 실패: Web Crypto API 접근이 거부되었습니다 (HTTPS 필요)');
      }
    }
    
    throw error;
  }
}
```

### 3.2 암호화 함수 구현 (테스트용)

```typescript
// lib/crypto/decrypt.ts (계속)

/**
 * AES-GCM 암호화 함수 (테스트 및 샘플 생성용)
 */
export async function encryptWithAESGCM(
  plaintext: Uint8Array,
  keyHex: string
): Promise<{
  iv: Uint8Array;
  cipher: Uint8Array;
  tag: Uint8Array;
}> {
  console.log(`🔒 AES-GCM 암호화 시작: ${plaintext.length} bytes`);

  try {
    // 키 준비
    const keyBuffer = hexToBytes(keyHex);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // 랜덤 IV 생성
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 암호화 실행  
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128
      },
      cryptoKey,
      plaintext
    );

    const encryptedArray = new Uint8Array(encrypted);
    
    // cipher와 tag 분리
    const cipher = encryptedArray.slice(0, encryptedArray.length - 16);
    const tag = encryptedArray.slice(encryptedArray.length - 16);

    console.log(`✅ 암호화 완료:
      - IV: ${iv.length} bytes
      - Cipher: ${cipher.length} bytes  
      - Tag: ${tag.length} bytes`);

    return { iv, cipher, tag };

  } catch (error) {
    console.error(`❌ 암호화 실패:`, error);
    throw error;
  }
}
```

---

## 4. 이미지 렌더링 로직 구현

### 4.1 기본 렌더링 함수

```typescript
// lib/image/render.ts

/**
 * Canvas에 복호화된 이미지 데이터를 렌더링
 */
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  fullBytes: Uint8Array,
  format: "aeia" | "aeiw"
): Promise<void> {
  console.log(`🎨 Canvas 렌더링 시작 - 데이터 크기: ${fullBytes.length} bytes, 포맷: ${format}`);
  
  const primaryMime = format === "aeia" ? "image/avif" : "image/webp";
  const fallbackMime = format === "aeia" ? "image/webp" : "image/avif";

  // 이미지 형식 검증
  const hasRiffHeader = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && 
                       fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebpHeader = hasRiffHeader && fullBytes[8] === 0x57 && 
                        fullBytes[9] === 0x45 && fullBytes[10] === 0x42 && 
                        fullBytes[11] === 0x50;
  const hasAvifHeader = fullBytes.slice(4, 8).every((byte, i) => 
                        byte === [0x66, 0x74, 0x79, 0x70][i]); // "ftyp"
  const hasJpegHeader = fullBytes[0] === 0xFF && fullBytes[1] === 0xD8 && 
                        fullBytes[2] === 0xFF;
  
  console.log(`🔍 이미지 형식 확인:
    - RIFF: ${hasRiffHeader}
    - WebP: ${hasWebpHeader}  
    - AVIF: ${hasAvifHeader}
    - JPEG: ${hasJpegHeader}`);
  
  // 지원하지 않는 형식 처리
  if (hasJpegHeader) {
    console.log('❌ JPEG 형식은 지원하지 않습니다');
    renderUnsupportedFormatCanvas(canvas, 'JPEG');
    return;
  }
  
  if (!hasRiffHeader && !hasAvifHeader) {
    console.log('⚠️ 알 수 없는 이미지 형식');
    renderTextToCanvas(canvas, fullBytes);
    return;
  }

  // WebP 실제 크기 추출
  let webpData = fullBytes;
  if (hasWebpHeader) {
    const riffSize = (fullBytes[4] | (fullBytes[5] << 8) | 
                     (fullBytes[6] << 16) | (fullBytes[7] << 24)) + 8;
    console.log(`📏 RIFF 크기: ${riffSize} bytes, 전체 데이터: ${fullBytes.length} bytes`);
    
    if (riffSize <= fullBytes.length) {
      webpData = fullBytes.slice(0, riffSize);
      console.log(`✂️ WebP 데이터 추출: ${webpData.length} bytes`);
    }
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmapWithFallback(webpData, format);
    console.log(`✅ 이미지 디코딩 성공`);
  } catch (primaryError) {
    console.warn(`❌ createImageBitmapWithFallback 실패, Image 객체로 재시도:`, primaryError);
    
    // Image 객체 fallback 방식
    try {
      bitmap = await createImageWithImageObject(webpData, primaryMime);
      console.log(`✅ Image 객체 방식 성공`);
    } catch (fallbackError) {
      console.error('❌ 모든 이미지 디코딩 방식 실패');
      console.log('📊 디코딩 실패 상세:', { primaryError, fallbackError });
      
      renderSuccessCanvas(canvas, fullBytes);
      return;
    }
  }

  // Canvas에 렌더링
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    console.log(`📐 Canvas 크기 설정: ${canvas.width}x${canvas.height}`);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context를 가져올 수 없습니다");
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    
    console.log(`✅ Canvas 렌더링 완료`);
  } catch (renderError) {
    console.error('❌ Canvas 렌더링 중 오류:', renderError);
    throw renderError;
  } finally {
    if (bitmap) {
      bitmap.close();
    }
  }
}
```

### 4.2 AVIF/WebP Fallback 함수

```typescript
// lib/image/render.ts (계속)

/**
 * AVIF 우선, WebP fallback으로 ImageBitmap 생성
 */
export async function createImageBitmapWithFallback(
  bytes: Uint8Array,
  _format: "aeia" | "aeiw"
): Promise<ImageBitmap> {
  // 실제 이미지 데이터 크기 검증 및 추출
  let imageData = bytes;
  
  // WebP의 경우 RIFF 헤더 검증 후 실제 크기만 추출
  const hasRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && 
                  bytes[2] === 0x46 && bytes[3] === 0x46;
  const hasWebp = hasRiff && bytes[8] === 0x57 && bytes[9] === 0x45 && 
                  bytes[10] === 0x42 && bytes[11] === 0x50;
  
  if (hasRiff && hasWebp) {
    const riffSize = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) + 8;
    if (riffSize <= bytes.length) {
      imageData = bytes.slice(0, riffSize);
      console.log(`📏 WebP 실제 데이터 크기: ${imageData.length} bytes (RIFF: ${riffSize})`);
    }
  }

  console.log(`🔍 이미지 데이터 샘플: ${Array.from(imageData.slice(0, 32))
    .map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

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
    console.warn(`⚠️ AVIF 디코딩 실패:`, error);
  }

  // 2차 시도: WebP로 디코딩
  try {
    console.log(`🔄 2차 시도: WebP 형식으로 디코딩 (${imageData.length} bytes)`);
    const webpBlob = new Blob([new Uint8Array(imageData)], { type: "image/webp" });
    const bitmap = await createImageBitmap(webpBlob);
    console.log(`✅ WebP 디코딩 성공`);
    return bitmap;
  } catch (webpError) {
    console.error(`❌ WebP 디코딩도 실패:`, webpError);
    throw new Error(`AVIF와 WebP 모두 디코딩 실패: AVIF(${avifError}), WebP(${webpError})`);
  }
}

/**
 * Image 객체를 사용한 fallback 방식
 */
async function createImageWithImageObject(
  webpData: Uint8Array,
  mimeType: string
): Promise<ImageBitmap> {
  const imageObj = new Image();
  const canvas2d = document.createElement('canvas');
  const ctx2d = canvas2d.getContext('2d');
  
  if (!ctx2d) {
    throw new Error('Canvas 2D context 생성 실패');
  }
  
  // Base64 변환
  const base64 = btoa(String.fromCharCode(...webpData));
  const dataUrl = `data:${mimeType};base64,${base64}`;
  
  console.log('🔄 Image 객체 + Base64 방식으로 재시도...');
  
  return new Promise<ImageBitmap>((resolve, reject) => {
    imageObj.onload = () => {
      try {
        canvas2d.width = imageObj.naturalWidth;
        canvas2d.height = imageObj.naturalHeight;
        ctx2d.drawImage(imageObj, 0, 0);
        
        createImageBitmap(canvas2d).then(resolve).catch(reject);
      } catch (drawError) {
        reject(drawError);
      }
    };
    imageObj.onerror = reject;
    imageObj.src = dataUrl;
  });
}
```

### 4.3 UI 렌더링 함수들

```typescript
// lib/image/render.ts (계속)

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
  const hasRiff = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && 
                  fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebp = hasRiff && fullBytes[8] === 0x57 && fullBytes[9] === 0x45 && 
                  fullBytes[10] === 0x42 && fullBytes[11] === 0x50;
  
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
  
  console.log('✅ 복호화 성공 Canvas 렌더링 완료');
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
  ctx.fillStyle = '#38a169';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('✅ WebP (.webp)', canvas.width / 2, 180);
  ctx.fillText('✅ AVIF (.avif)', canvas.width / 2, 210);
  
  console.log(`✅ ${format} 형식 지원 안내 렌더링 완료`);
}

/**
 * 텍스트 모드로 복호화 결과 표시
 */
function renderTextToCanvas(canvas: HTMLCanvasElement, fullBytes: Uint8Array) {
  canvas.width = 500;
  canvas.height = 400;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  
  // 배경
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 제목
  ctx.fillStyle = '#28a745';
  ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎉 복호화 성공!', canvas.width / 2, 60);
  
  // 데이터 정보
  ctx.fillStyle = '#6c757d';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.fillText(`데이터 크기: ${fullBytes.length.toLocaleString()} bytes`, canvas.width / 2, 120);
  ctx.fillText('복호화된 바이너리 데이터를 텍스트로 표시 중...', canvas.width / 2, 140);
  
  // 샘플 데이터 표시
  const resultStr = new TextDecoder('utf-8', { fatal: false }).decode(fullBytes.slice(0, 200));
  ctx.font = '10px monospace';
  ctx.fillStyle = '#495057';
  
  const sampleText = resultStr.slice(0, 100).replace(/[^\x20-\x7E]/g, '·');
  const lines = [];
  for (let i = 0; i < sampleText.length; i += 50) {
    lines.push(sampleText.slice(i, i + 50));
  }
  
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, 180 + index * 15);
  });
  
  console.log('✅ 텍스트 모드 렌더링 완료');
}
```

---

계속해서 React 컴포넌트, 캐싱 시스템, UI/UX 개선 등을 구현하겠습니다...

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "\ud504\ub85c\uc81d\ud2b8 \uad6c\uc870 \ubc0f \ud30c\uc77c\ub4e4 \ubd204\uc11d", "status": "completed", "activeForm": "\ud504\ub85c\uc81d\ud2b8 \uad6c\uc870 \ubc0f \ud30c\uc77c\ub4e4 \ubd204\uc11d \uc644\ub8cc"}, {"content": "\uc778\ud134\uac1c\ubc1c\uc790\uc6a9 \uac00\uc774\ub4dc \ubb38\uc11c \uc791\uc131", "status": "completed", "activeForm": "\uc778\ud134\uac1c\ubc1c\uc790\uc6a9 \uac00\uc774\ub4dc \ubb38\uc11c \uc791\uc131 \uc644\ub8cc"}, {"content": "\ucf54\ub4dc \uad6c\ud604 \ub2e8\uacc4\ubcc4 \uc124\uba85\uc11c \uc791\uc131", "status": "completed", "activeForm": "\ucf54\ub4dc \uad6c\ud604 \ub2e8\uacc4\ubcc4 \uc124\uba85\uc11c \uc791\uc131 \uc644\ub8cc"}]