#!/usr/bin/env node

/**
 * 실제 브라우저에서 디코딩 가능한 WebP 이미지 생성
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 실제 브라우저에서 검증된 1x1 WebP 이미지 (base64에서 변환)
function createRealWebP() {
  // 1x1 투명 픽셀 WebP 이미지 (실제 브라우저에서 작동하는 것)
  const base64WebP = "UklGRjoAAABXRUJQVlA4TC0AAAAvAAAAAQcQERGIiP4HAA==";
  return Buffer.from(base64WebP, 'base64');
}

const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const CIPHER_LENGTH = 1048576;

function createEncryptedFileWithRealWebP() {
  try {
    console.log('실제 브라우저에서 작동하는 WebP를 포함한 암호화 이미지 생성 중...');
    
    // IV와 태그 생성
    const iv = crypto.randomBytes(IV_LENGTH);
    const tag = crypto.randomBytes(TAG_LENGTH);
    
    // 실제 WebP 이미지
    const realWebP = createRealWebP();
    console.log(`실제 WebP 크기: ${realWebP.length} bytes`);
    console.log('WebP 헤더 (hex):', realWebP.slice(0, 20).toString('hex'));
    
    // 식별 패턴 추가
    const patternText = "ENCRYPTED_DEMO_IMAGE_SUCCESS_REAL_WEBP";
    const pattern = Buffer.from(patternText, 'utf8');
    
    // 1MB 헤드 데이터 생성
    const head = Buffer.alloc(CIPHER_LENGTH);
    
    // WebP 이미지를 맨 앞에 배치
    realWebP.copy(head, 0);
    
    // 패턴을 WebP 바로 뒤에 배치
    pattern.copy(head, realWebP.length);
    
    // 패턴을 여러 위치에 반복 배치
    for (let i = 0; i < 20; i++) {
      const offset = realWebP.length + pattern.length + 100 + (i * 1000);
      if (offset + pattern.length < CIPHER_LENGTH) {
        pattern.copy(head, offset);
      }
    }
    
    // 나머지는 의미있는 패딩으로 채움
    const padding = Buffer.from('REAL_WEBP_PADDING_DATA_');
    for (let i = realWebP.length + pattern.length + 50; i < CIPHER_LENGTH; i += padding.length) {
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
    // 먼저 실제 WebP만 저장해서 테스트
    const realWebP = createRealWebP();
    const testWebpPath = path.join(__dirname, '../public/test-real.webp');
    fs.writeFileSync(testWebpPath, realWebP);
    console.log(`테스트용 실제 WebP 저장: ${testWebpPath} (${realWebP.length} bytes)`);
    
    // 암호화된 이미지 생성
    const encryptedData = createEncryptedFileWithRealWebP();
    
    // public 폴더에 저장
    const outputPath = path.join(__dirname, '../public/encrypted-demo.aeiw');
    fs.writeFileSync(outputPath, encryptedData);
    
    console.log(`✅ 실제 WebP를 포함한 암호화 파일 생성 완료: ${outputPath}`);
    console.log('🔍 테스트: http://localhost:3005/test-real.webp 에서 WebP 유효성 확인');
    console.log(`🔑 사용된 키: ${DEMO_KEY_HEX}`);
    
  } catch (error) {
    console.error('❌ 실패:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}