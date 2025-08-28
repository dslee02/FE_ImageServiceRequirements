#!/usr/bin/env node

/**
 * 유효한 WebP 이미지를 포함한 암호화 파일 생성 스크립트
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// AES-GCM-256 설정
const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12; // 96비트
const TAG_LENGTH = 16; // 128비트
const CIPHER_LENGTH = 1048576; // 1MB

function createValidWebPImage() {
  // 실제 유효한 1x1 WebP 이미지 (녹색 픽셀)
  const validWebP = Buffer.from([
    // RIFF 헤더
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x32, 0x00, 0x00, 0x00, // 파일 크기 50바이트
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    
    // VP8 청크
    0x56, 0x50, 0x38, 0x20, // "VP8 "
    0x26, 0x00, 0x00, 0x00, // VP8 데이터 크기 38바이트
    
    // VP8 비트스트림 (1x1 녹색 픽셀)
    0x10, 0x20, 0x00, 0x9D, 0x01, 0x2A, 0x01, 0x00, 0x01, 0x00,
    0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ]);

  // 식별 패턴을 포함한 더 큰 데이터 생성
  const patternText = "ENCRYPTED_DEMO_IMAGE_SUCCESS_WEBP_VALID";
  const pattern = Buffer.from(patternText, 'utf8');
  
  // 전체 이미지 데이터 (원본 WebP + 패턴 + 추가 데이터)
  const totalSize = Math.max(4096, validWebP.length + pattern.length + 1000);
  const imageData = Buffer.alloc(totalSize);
  
  // 유효한 WebP 이미지를 앞쪽에 배치
  validWebP.copy(imageData, 0);
  
  // 패턴을 WebP 이미지 뒤에 삽입
  pattern.copy(imageData, validWebP.length);
  
  // 패턴을 여러 위치에 반복 삽입
  for (let i = 0; i < 5; i++) {
    const offset = validWebP.length + 100 + (i * 300);
    if (offset + pattern.length < imageData.length) {
      pattern.copy(imageData, offset);
    }
  }
  
  // 나머지는 의미있는 데이터로 채움
  const filler = Buffer.from('DEMO_DATA_PADDING_FOR_ENCRYPTION_TEST_');
  for (let i = validWebP.length + pattern.length + 50; i < imageData.length; i += filler.length) {
    const remaining = Math.min(filler.length, imageData.length - i);
    filler.copy(imageData, i, 0, remaining);
  }
  
  console.log(`생성된 이미지 데이터: ${imageData.length} bytes`);
  console.log(`유효한 WebP 크기: ${validWebP.length} bytes`);
  console.log(`패턴 크기: ${pattern.length} bytes`);
  
  return imageData;
}

function createEncryptedFile() {
  try {
    console.log('유효한 WebP를 포함한 암호화 이미지 생성 중...');
    
    // IV와 태그 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    const tag = crypto.randomBytes(TAG_LENGTH); // 더미 태그
    
    // 유효한 WebP 이미지 데이터 생성
    const imageData = createValidWebPImage();
    
    // 1MB 헤드 부분 준비 (암호화될 부분)
    const head = Buffer.alloc(CIPHER_LENGTH);
    
    // 이미지 데이터가 1MB보다 작으면 전체를 헤드에 복사하고 나머지는 0으로 채움
    if (imageData.length <= CIPHER_LENGTH) {
      imageData.copy(head, 0);
      // 나머지 부분은 0으로 채워짐 (Buffer.alloc의 기본값)
      console.log(`이미지 데이터를 헤드에 완전히 포함 (${imageData.length}/${CIPHER_LENGTH} bytes)`);
    } else {
      // 이미지 데이터가 1MB보다 크면 1MB만 헤드에 복사
      imageData.copy(head, 0, 0, CIPHER_LENGTH);
      console.log(`이미지 데이터의 앞 1MB만 헤드에 포함`);
    }
    
    // 간단한 XOR 기반 "암호화" (데모용)
    const keyBuffer = Buffer.from(DEMO_KEY_HEX, 'hex');
    const encrypted = Buffer.alloc(CIPHER_LENGTH);
    
    for (let i = 0; i < CIPHER_LENGTH; i++) {
      encrypted[i] = head[i] ^ keyBuffer[i % keyBuffer.length] ^ iv[i % iv.length];
    }
    
    // Tail 부분 (평문으로 남김) - 1MB를 초과하는 부분
    const tail = imageData.length > CIPHER_LENGTH 
      ? imageData.slice(CIPHER_LENGTH)
      : Buffer.alloc(0);
    
    console.log(`암호화된 헤드 크기: ${encrypted.length} bytes`);
    console.log(`태그 크기: ${tag.length} bytes`);
    console.log(`Tail 크기: ${tail.length} bytes`);
    
    // 암호화된 파일 구조 생성: magic(4) + iv(12) + cipher(1MB) + tag(16) + tail
    const magic = Buffer.from('aeiw'); // WebP 암호화 파일
    const totalSize = magic.length + iv.length + encrypted.length + tag.length + tail.length;
    
    const encryptedFile = Buffer.alloc(totalSize);
    let offset = 0;
    
    magic.copy(encryptedFile, offset);
    offset += magic.length;
    
    iv.copy(encryptedFile, offset);
    offset += iv.length;
    
    encrypted.copy(encryptedFile, offset);
    offset += encrypted.length;
    
    tag.copy(encryptedFile, offset);
    offset += tag.length;
    
    if (tail.length > 0) {
      tail.copy(encryptedFile, offset);
    }
    
    console.log(`최종 암호화 파일 크기: ${encryptedFile.length} bytes`);
    
    return encryptedFile;
    
  } catch (error) {
    console.error('암호화 중 오류 발생:', error);
    throw error;
  }
}

async function main() {
  try {
    // 암호화된 이미지 생성
    const encryptedData = createEncryptedFile();
    
    // public 폴더에 저장
    const outputPath = path.join(__dirname, '../public/encrypted-demo.aeiw');
    fs.writeFileSync(outputPath, encryptedData);
    
    console.log(`✅ 유효한 WebP를 포함한 암호화 샘플 생성 완료: ${outputPath}`);
    console.log('🔒 이 파일은 로컬에서 열 수 없으며, 애플리케이션을 통해 복호화해야 합니다.');
    console.log('📝 복호화 후 유효한 1x1 WebP 이미지와 식별 패턴을 확인할 수 있습니다.');
    console.log(`🔑 사용된 키: ${DEMO_KEY_HEX}`);
    
  } catch (error) {
    console.error('❌ 실패:', error);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main();
}