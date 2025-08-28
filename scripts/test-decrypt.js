#!/usr/bin/env node

/**
 * 복호화 테스트 스크립트
 */

const fs = require('fs');
const path = require('path');

// 생성한 암호화 파일 읽기
const encryptedFile = fs.readFileSync(path.join(__dirname, '../public/encrypted-demo.aeiw'));

console.log(`암호화 파일 크기: ${encryptedFile.length} bytes`);

// 파일 구조 파싱
const magic = encryptedFile.slice(0, 4).toString();
const iv = encryptedFile.slice(4, 16);
const cipher = encryptedFile.slice(16, 16 + 1048576);
const tag = encryptedFile.slice(16 + 1048576, 16 + 1048576 + 16);

console.log(`Magic: ${magic}`);
console.log(`IV 길이: ${iv.length}`);
console.log(`Cipher 길이: ${cipher.length}`);
console.log(`Tag 길이: ${tag.length}`);

// 복호화 시뮬레이션 (브라우저와 동일한 로직)
const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
function hexToBytes(hex) {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error('Invalid hex string');
  return Buffer.from(matches.map(byte => parseInt(byte, 16)));
}

const keyBytes = hexToBytes(keyHex);
const decrypted = Buffer.alloc(cipher.length);

for (let i = 0; i < cipher.length; i++) {
  decrypted[i] = cipher[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
}

console.log(`복호화된 데이터 크기: ${decrypted.length} bytes`);

// 패턴 확인
const resultStr = decrypted.slice(0, 2000).toString('utf8', 0, 2000);
console.log('복호화된 데이터 샘플:', resultStr.slice(0, 200));

if (resultStr.includes('ENCRYPTED_DEMO_IMAGE_SUCCESS')) {
  console.log('✅ 복호화 성공: 식별 패턴 확인됨');
} else {
  console.log('⚠️ 식별 패턴을 찾을 수 없음');
  
  // RIFF 헤더 확인
  if (decrypted[0] === 0x52 && decrypted[1] === 0x49 && decrypted[2] === 0x46 && decrypted[3] === 0x46) {
    console.log('✅ RIFF 헤더 발견: WebP 형식으로 보임');
  }
  
  // 바이너리 데이터 확인
  console.log('처음 16바이트 (hex):', decrypted.slice(0, 16).toString('hex'));
  console.log('처음 16바이트 (문자):', decrypted.slice(0, 16).toString('binary'));
}