#!/usr/bin/env node

/**
 * WebP 파일 구조 디버깅 스크립트
 */

const fs = require('fs');
const path = require('path');

// 복호화된 데이터로 WebP 구조 분석
const encryptedFile = fs.readFileSync(path.join(__dirname, '../public/encrypted-demo.aeiw'));
const DEMO_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// 파일 파싱
const magic = encryptedFile.slice(0, 4).toString();
const iv = encryptedFile.slice(4, 16);
const cipher = encryptedFile.slice(16, 16 + 1048576);

// 복호화
function hexToBytes(hex) {
  const matches = hex.match(/.{1,2}/g);
  return Buffer.from(matches.map(byte => parseInt(byte, 16)));
}

const keyBytes = hexToBytes(DEMO_KEY_HEX);
const decrypted = Buffer.alloc(cipher.length);

for (let i = 0; i < cipher.length; i++) {
  decrypted[i] = cipher[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
}

console.log('=== WebP 구조 분석 ===');
console.log('처음 100바이트 (hex):');
console.log(decrypted.slice(0, 100).toString('hex'));

console.log('\n처음 50바이트 (문자):');
const chars = [];
for (let i = 0; i < 50; i++) {
  const char = decrypted[i];
  if (char >= 32 && char <= 126) {
    chars.push(String.fromCharCode(char));
  } else {
    chars.push('.');
  }
}
console.log(chars.join(''));

// RIFF 구조 분석
if (decrypted[0] === 0x52 && decrypted[1] === 0x49 && decrypted[2] === 0x46 && decrypted[3] === 0x46) {
  console.log('\n=== RIFF 헤더 분석 ===');
  
  // 파일 크기 (리틀 엔디안)
  const fileSize = decrypted[4] | (decrypted[5] << 8) | (decrypted[6] << 16) | (decrypted[7] << 24);
  console.log(`RIFF 파일 크기: ${fileSize} bytes (전체 크기는 ${fileSize + 8} bytes)`);
  
  // WEBP 확인
  const webpMagic = decrypted.slice(8, 12).toString();
  console.log(`WEBP 매직: "${webpMagic}"`);
  
  if (webpMagic === 'WEBP') {
    console.log('\n=== VP8 청크 분석 ===');
    const vp8Magic = decrypted.slice(12, 16).toString();
    console.log(`VP8 매직: "${vp8Magic}"`);
    
    if (vp8Magic === 'VP8 ') {
      const vp8Size = decrypted[16] | (decrypted[17] << 8) | (decrypted[18] << 16) | (decrypted[19] << 24);
      console.log(`VP8 데이터 크기: ${vp8Size} bytes`);
      console.log(`계산된 전체 WebP 크기: ${8 + 4 + 4 + vp8Size} bytes`);
      
      // 실제 WebP 데이터만 추출해서 파일로 저장
      const actualWebpSize = 8 + 4 + 4 + vp8Size; // RIFF(8) + WEBP(4) + VP8 헤더(4) + VP8 데이터
      const webpData = decrypted.slice(0, actualWebpSize);
      
      console.log(`\n추출할 WebP 데이터 크기: ${webpData.length} bytes`);
      console.log('WebP 데이터 (hex):');
      console.log(webpData.toString('hex'));
      
      // 디버깅용으로 WebP 파일 저장
      const debugPath = path.join(__dirname, '../public/debug-extracted.webp');
      fs.writeFileSync(debugPath, webpData);
      console.log(`\n디버깅용 WebP 파일 저장: ${debugPath}`);
      console.log('브라우저에서 http://localhost:3005/debug-extracted.webp 로 확인해보세요.');
    }
  }
} else {
  console.log('❌ RIFF 헤더를 찾을 수 없습니다.');
}