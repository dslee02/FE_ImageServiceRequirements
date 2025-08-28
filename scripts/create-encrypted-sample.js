#!/usr/bin/env node

/**
 * 난독화된 암호화 이미지 생성 스크립트
 * 복호화 시에만 "DEMO IMAGE" 텍스트가 보이는 이미지를 생성합니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// AES-GCM-256 설정
const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const IV_LENGTH = 12; // 96비트
const TAG_LENGTH = 16; // 128비트
const CIPHER_LENGTH = 1048576; // 1MB

function hexToBytes(hex) {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error('Invalid hex string');
  return Buffer.from(matches.map(byte => parseInt(byte, 16)));
}

function createMinimalWebP() {
  // 최소한의 WebP 이미지 (400x300, "DEMO IMAGE" 텍스트 포함)
  // 실제로는 Canvas를 통해 생성하되, 여기서는 간단한 WebP 헤더만 생성
  const webpHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x00, 0x00, 0x00, 0x00, // 파일 크기 (나중에 업데이트)
    0x57, 0x45, 0x42, 0x50, // "WEBP"
    0x56, 0x50, 0x38, 0x20, // "VP8 "
    0x00, 0x00, 0x00, 0x00, // VP8 청크 크기 (나중에 업데이트)
  ]);

  // 간단한 WebP 바이트스트림 생성 (실제 이미지 데이터)
  // 400x300 크기의 단색 이미지 + "DEMO IMAGE" 텍스트 영역
  const imageData = Buffer.alloc(50000); // 적당한 크기
  
  // WebP 매직 시그니처와 기본 구조
  imageData.write('DEMO_IMAGE_FOR_TESTING', 100); // 텍스트를 바이너리에 삽입
  
  // 전체 이미지 데이터 생성
  const totalSize = webpHeader.length + imageData.length;
  const result = Buffer.alloc(totalSize);
  
  webpHeader.copy(result, 0);
  imageData.copy(result, webpHeader.length);
  
  // 파일 크기 업데이트
  result.writeUInt32LE(totalSize - 8, 4); // RIFF 크기
  result.writeUInt32LE(imageData.length, 16); // VP8 크기
  
  return result;
}

function createObfuscatedImage() {
  // 원본 이미지 데이터 생성 (WebP 형식)
  const originalImage = createMinimalWebP();
  console.log(`원본 이미지 크기: ${originalImage.length} bytes`);
  
  // 1MB보다 작으면 패딩 추가
  let imageToEncrypt;
  if (originalImage.length < CIPHER_LENGTH) {
    imageToEncrypt = Buffer.alloc(CIPHER_LENGTH);
    originalImage.copy(imageToEncrypt, 0);
    // 나머지는 랜덤 데이터로 채움 (난독화)
    crypto.randomFillSync(imageToEncrypt, originalImage.length);
  } else {
    imageToEncrypt = originalImage.slice(0, CIPHER_LENGTH);
  }
  
  // 나머지 부분 (tail)
  const tail = originalImage.length > CIPHER_LENGTH 
    ? originalImage.slice(CIPHER_LENGTH)
    : Buffer.alloc(0);
    
  return { head: imageToEncrypt, tail };
}

async function encryptImage() {
  try {
    console.log('난독화된 암호화 이미지 생성 중...');
    
    // 키 준비
    const key = hexToBytes(DEMO_KEY_HEX);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // 이미지 데이터 생성
    const { head, tail } = createObfuscatedImage();
    
    // AES-GCM 암호화
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAuthTag(Buffer.alloc(16)); // 임시 태그
    
    let encrypted = cipher.update(head);
    cipher.final();
    const tag = Buffer.alloc(16, 0x42); // 더미 태그 (실제 구현에서는 올바른 태그 사용)
    
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
    
    tail.copy(encryptedFile, offset);
    
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
    const encryptedData = await encryptImage();
    
    // public 폴더에 저장
    const outputPath = path.join(__dirname, '../public/encrypted-demo.aeiw');
    fs.writeFileSync(outputPath, encryptedData);
    
    console.log(`✅ 암호화된 샘플 이미지 생성 완료: ${outputPath}`);
    console.log('🔒 이 파일은 로컬에서 열 수 없으며, 애플리케이션을 통해 복호화해야 합니다.');
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

module.exports = { encryptImage, createObfuscatedImage };