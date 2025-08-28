#!/usr/bin/env node

/**
 * 간단한 암호화 이미지 생성 스크립트
 * 복호화 시에만 식별 가능한 더미 이미지를 생성합니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// AES-GCM-256 설정
const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12; // 96비트
const TAG_LENGTH = 16; // 128비트
const CIPHER_LENGTH = 1048576; // 1MB

function createSimpleWebPData() {
  // 매우 간단한 WebP 형태 데이터 생성
  // 실제 WebP가 아니라 식별 가능한 패턴의 바이너리 데이터
  const header = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x20, 0x1A, 0x00, 0x00, // 파일 크기 (대략)
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x58, // "VP8X"
    0x0A, 0x00, 0x00, 0x00, // 청크 크기
    0x10, 0x00, 0x00, 0x00, // VP8X 플래그
    0x8F, 0x01, 0x00,       // 폭 (399)
    0x2B, 0x01, 0x00        // 높이 (299)
  ]);

  // 패턴 데이터 생성 - 복호화 후 식별 가능한 텍스트
  const patternText = "ENCRYPTED_DEMO_IMAGE_SUCCESS";
  const pattern = Buffer.from(patternText, 'utf8');
  
  // 전체 이미지 데이터 (1MB보다 작게)
  const imageData = Buffer.alloc(8192);
  header.copy(imageData, 0);
  
  // 패턴을 여러 위치에 반복해서 삽입
  for (let i = 0; i < 10; i++) {
    const offset = header.length + (i * 200);
    if (offset + pattern.length < imageData.length) {
      pattern.copy(imageData, offset);
    }
  }
  
  // 나머지는 랜덤으로 채워서 난독화
  for (let i = header.length + 2000; i < imageData.length; i += 100) {
    const randomChunk = crypto.randomBytes(Math.min(50, imageData.length - i));
    randomChunk.copy(imageData, i);
  }
  
  return imageData;
}

function createEncryptedFile() {
  try {
    console.log('난독화된 암호화 이미지 생성 중...');
    
    // IV와 태그 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    const tag = crypto.randomBytes(TAG_LENGTH); // 더미 태그
    
    // 이미지 데이터 생성
    const imageData = createSimpleWebPData();
    console.log(`원본 이미지 데이터 크기: ${imageData.length} bytes`);
    
    // 1MB 헤드 부분 준비 (암호화될 부분)
    const head = Buffer.alloc(CIPHER_LENGTH);
    imageData.copy(head, 0, 0, Math.min(imageData.length, CIPHER_LENGTH));
    
    // 나머지 부분은 랜덤으로 채움 (난독화)
    if (imageData.length < CIPHER_LENGTH) {
      crypto.randomFillSync(head, imageData.length);
    }
    
    // 간단한 XOR 기반 "암호화" (데모용)
    const keyBuffer = Buffer.from(DEMO_KEY_HEX, 'hex');
    const encrypted = Buffer.alloc(CIPHER_LENGTH);
    
    for (let i = 0; i < CIPHER_LENGTH; i++) {
      encrypted[i] = head[i] ^ keyBuffer[i % keyBuffer.length] ^ iv[i % iv.length];
    }
    
    // Tail 부분 (평문으로 남김)
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
    
    console.log(`✅ 암호화된 샘플 이미지 생성 완료: ${outputPath}`);
    console.log('🔒 이 파일은 로컬에서 열 수 없으며, 애플리케이션을 통해 복호화해야 합니다.');
    console.log('📝 복호화 후 "ENCRYPTED_DEMO_IMAGE_SUCCESS" 텍스트 패턴이 보입니다.');
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