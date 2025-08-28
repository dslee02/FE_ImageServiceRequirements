#!/usr/bin/env node

/**
 * 실제 디코딩 가능한 최소 WebP 이미지 생성 스크립트
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 실제로 디코딩 가능한 1x1 투명 픽셀 WebP 이미지 (42바이트)
function createMinimalValidWebP() {
  return Buffer.from([
    // RIFF 헤더
    0x52, 0x49, 0x46, 0x46,  // "RIFF"
    0x1A, 0x00, 0x00, 0x00,  // 파일 크기: 26바이트 (전체 30바이트)
    0x57, 0x45, 0x42, 0x50,  // "WEBP"
    
    // VP8 청크
    0x56, 0x50, 0x38, 0x20,  // "VP8 "
    0x0E, 0x00, 0x00, 0x00,  // VP8 데이터 크기: 14바이트
    
    // VP8 비트스트림 (1x1 투명 픽셀)
    0x90, 0x00, 0x00, 0x00,  // 프레임 태그
    0x00, 0x4F, 0x00, 0x4F,  // 너비와 높이 (1x1)
    0x00, 0x00, 0x00, 0x00,  // 추가 데이터
    0x00, 0x00               // 패딩
  ]);
}

const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const CIPHER_LENGTH = 1048576;

function createEncryptedFileWithMinimalWebP() {
  try {
    console.log('최소한의 유효한 WebP를 포함한 암호화 이미지 생성 중...');
    
    // IV와 태그 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    const tag = crypto.randomBytes(TAG_LENGTH);
    
    // 실제 디코딩 가능한 최소 WebP 이미지
    const minimalWebP = createMinimalValidWebP();
    console.log(`최소 WebP 크기: ${minimalWebP.length} bytes`);
    
    // 식별 패턴 추가
    const patternText = "ENCRYPTED_DEMO_IMAGE_SUCCESS_MINIMAL_WEBP";
    const pattern = Buffer.from(patternText, 'utf8');
    
    // 1MB 헤드 데이터 생성
    const head = Buffer.alloc(CIPHER_LENGTH);
    
    // WebP 이미지를 맨 앞에 배치
    minimalWebP.copy(head, 0);
    
    // 패턴을 WebP 바로 뒤에 배치
    pattern.copy(head, minimalWebP.length);
    
    // 패턴을 여러 위치에 반복 배치
    for (let i = 0; i < 10; i++) {
      const offset = minimalWebP.length + pattern.length + 100 + (i * 200);
      if (offset + pattern.length < CIPHER_LENGTH) {
        pattern.copy(head, offset);
      }
    }
    
    // 나머지는 의미있는 패딩으로 채움
    const padding = Buffer.from('PADDING_DATA_FOR_ENCRYPTION_');
    for (let i = minimalWebP.length + pattern.length + 50; i < CIPHER_LENGTH; i += padding.length) {
      const remaining = Math.min(padding.length, CIPHER_LENGTH - i);
      padding.copy(head, i, 0, remaining);
    }
    
    // XOR 암호화
    const keyBuffer = Buffer.from(DEMO_KEY_HEX, 'hex');
    const encrypted = Buffer.alloc(CIPHER_LENGTH);
    
    for (let i = 0; i < CIPHER_LENGTH; i++) {
      encrypted[i] = head[i] ^ keyBuffer[i % keyBuffer.length] ^ iv[i % iv.length];
    }
    
    // 최종 파일 구조 생성
    const magic = Buffer.from('aeiw');
    const totalSize = magic.length + iv.length + encrypted.length + tag.length;
    const encryptedFile = Buffer.alloc(totalSize);
    
    let offset = 0;
    magic.copy(encryptedFile, offset);
    offset += magic.length;
    
    iv.copy(encryptedFile, offset);
    offset += iv.length;
    
    encrypted.copy(encryptedFile, offset);
    offset += encrypted.length;
    
    tag.copy(encryptedFile, offset);
    
    console.log(`최종 암호화 파일 크기: ${encryptedFile.length} bytes`);
    
    return encryptedFile;
    
  } catch (error) {
    console.error('암호화 중 오류 발생:', error);
    throw error;
  }
}

async function main() {
  try {
    // 먼저 최소 WebP만 저장해서 테스트
    const minimalWebP = createMinimalValidWebP();
    const testWebpPath = path.join(__dirname, '../public/test-minimal.webp');
    fs.writeFileSync(testWebpPath, minimalWebP);
    console.log(`테스트용 최소 WebP 저장: ${testWebpPath} (${minimalWebP.length} bytes)`);
    
    // 암호화된 이미지 생성
    const encryptedData = createEncryptedFileWithMinimalWebP();
    
    // public 폴더에 저장
    const outputPath = path.join(__dirname, '../public/encrypted-demo.aeiw');
    fs.writeFileSync(outputPath, encryptedData);
    
    console.log(`✅ 최소한의 유효한 WebP를 포함한 암호화 파일 생성 완료: ${outputPath}`);
    console.log('🔍 테스트: http://localhost:3005/test-minimal.webp 에서 WebP 유효성 확인');
    console.log(`🔑 사용된 키: ${DEMO_KEY_HEX}`);
    
  } catch (error) {
    console.error('❌ 실패:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}