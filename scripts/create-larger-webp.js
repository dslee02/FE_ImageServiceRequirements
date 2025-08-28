#!/usr/bin/env node

/**
 * 더 큰 크기의 유효한 WebP 이미지 생성 스크립트
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 10x10 픽셀 단색 WebP 이미지 생성
function createLargerWebP() {
  // 실제 10x10 WebP 이미지 (단순한 VP8 데이터)
  return Buffer.from([
    // RIFF 헤더
    0x52, 0x49, 0x46, 0x46,  // "RIFF"
    0x3E, 0x00, 0x00, 0x00,  // 파일 크기: 62바이트
    0x57, 0x45, 0x42, 0x50,  // "WEBP"
    
    // VP8 청크
    0x56, 0x50, 0x38, 0x20,  // "VP8 "
    0x32, 0x00, 0x00, 0x00,  // VP8 데이터 크기: 50바이트
    
    // VP8 비트스트림 (10x10 흰색 이미지)
    0x57, 0x01, 0x00, 0x9D, 0x01, 0x2A, 0x0A, 0x00, 0x0A, 0x00,
    0x00, 0x47, 0x08, 0x85, 0x85, 0x88, 0x85, 0x84, 0x88, 0x02,
    0x02, 0x02, 0x0C, 0x0C, 0x0C, 0x0C, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
}

const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const CIPHER_LENGTH = 1048576;

function createEncryptedFileWithLargerWebP() {
  try {
    console.log('10x10 크기의 유효한 WebP를 포함한 암호화 이미지 생성 중...');
    
    // IV와 태그 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    const tag = crypto.randomBytes(TAG_LENGTH);
    
    // 10x10 WebP 이미지
    const largerWebP = createLargerWebP();
    console.log(`10x10 WebP 크기: ${largerWebP.length} bytes`);
    
    // 식별 패턴 추가
    const patternText = "ENCRYPTED_DEMO_IMAGE_SUCCESS_10X10_WEBP";
    const pattern = Buffer.from(patternText, 'utf8');
    
    // 1MB 헤드 데이터 생성
    const head = Buffer.alloc(CIPHER_LENGTH);
    
    // WebP 이미지를 맨 앞에 배치
    largerWebP.copy(head, 0);
    
    // 패턴을 WebP 바로 뒤에 배치
    pattern.copy(head, largerWebP.length);
    
    // 패턴을 여러 위치에 반복 배치
    for (let i = 0; i < 15; i++) {
      const offset = largerWebP.length + pattern.length + 100 + (i * 500);
      if (offset + pattern.length < CIPHER_LENGTH) {
        pattern.copy(head, offset);
      }
    }
    
    // 나머지는 의미있는 패딩으로 채움
    const padding = Buffer.from('WEBP_10X10_PADDING_DATA_');
    for (let i = largerWebP.length + pattern.length + 50; i < CIPHER_LENGTH; i += padding.length) {
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
    // 먼저 10x10 WebP만 저장해서 테스트
    const largerWebP = createLargerWebP();
    const testWebpPath = path.join(__dirname, '../public/test-10x10.webp');
    fs.writeFileSync(testWebpPath, largerWebP);
    console.log(`테스트용 10x10 WebP 저장: ${testWebpPath} (${largerWebP.length} bytes)`);
    
    // 암호화된 이미지 생성
    const encryptedData = createEncryptedFileWithLargerWebP();
    
    // public 폴더에 저장
    const outputPath = path.join(__dirname, '../public/encrypted-demo.aeiw');
    fs.writeFileSync(outputPath, encryptedData);
    
    console.log(`✅ 10x10 유효한 WebP를 포함한 암호화 파일 생성 완료: ${outputPath}`);
    console.log('🔍 테스트: http://localhost:3005/test-10x10.webp 에서 WebP 유효성 확인');
    console.log(`🔑 사용된 키: ${DEMO_KEY_HEX}`);
    
  } catch (error) {
    console.error('❌ 실패:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}