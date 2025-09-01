const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 복호화 함수
function decryptFile(encryptedPath, keyHex) {
  try {
    console.log(`🔐 복호화 검증 시작: ${encryptedPath}`);
    
    // 키를 Buffer로 변환
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error(`잘못된 키 길이: ${key.length} bytes (32 bytes 필요)`);
    }
    
    // 암호화된 파일 읽기
    const encryptedData = fs.readFileSync(encryptedPath);
    console.log(`📁 암호화된 파일 크기: ${encryptedData.length} bytes`);
    
    // 구조 파싱: IV(12) + AuthTag(16) + EncryptedData
    const iv = encryptedData.slice(0, 12);
    const authTag = encryptedData.slice(12, 28);
    const encrypted = encryptedData.slice(28);
    
    console.log(`📋 파일 구조:`);
    console.log(`  - IV: ${iv.length} bytes`);
    console.log(`  - AuthTag: ${authTag.length} bytes`);
    console.log(`  - 암호화된 데이터: ${encrypted.length} bytes`);
    
    // AES-GCM 복호화
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    console.log(`✅ 복호화 완료!`);
    console.log(`📁 복호화된 데이터 크기: ${decrypted.length} bytes`);
    
    // 복호화된 데이터의 헤더 확인
    const header = decrypted.slice(0, 16);
    console.log(`📋 복호화된 파일 헤더 (hex): ${header.toString('hex')}`);
    
    // AVIF 헤더 확인
    const ftypHeader = decrypted.slice(4, 8);
    const isAvif = ftypHeader.toString() === 'ftyp';
    console.log(`🔍 AVIF 헤더 확인: ${isAvif ? '✅ 올바른 AVIF 파일' : '❌ AVIF 헤더 없음'}`);
    
    if (isAvif) {
      const avifBrand = decrypted.slice(8, 12);
      console.log(`   - AVIF 브랜드: ${avifBrand.toString()}`);
    }
    
    return decrypted;
    
  } catch (error) {
    console.error(`❌ 복호화 실패: ${error.message}`);
    throw error;
  }
}

// 메인 실행
function main() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  // 키 매핑 (app/page.tsx와 동일)
  const keys = {
    "encrypted-file_example_AVIF_178kb.aeia": "7511d2b25be2548a0673dae2068c3476556095906e561cf730b6e203de6deb98",
    "encrypted-file_example_AVIF_1200kb.aeia": "eaef4af514f6f82cdd831e8864a6eaec217fbf0f39356b8e77445ba64e218668",
  };
  
  console.log('🔍 암호화된 AVIF 파일 복호화 검증\n');
  
  Object.entries(keys).forEach(([filename, keyHex]) => {
    const filePath = path.join(publicDir, filename);
    
    console.log(`\n=== ${filename} ===`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 파일이 없습니다: ${filePath}`);
      return;
    }
    
    try {
      const decrypted = decryptFile(filePath, keyHex);
      
      // 원본 파일과 비교
      const originalName = filename.replace('encrypted-', '').replace('.aeia', '.avif');
      const originalPath = path.join(publicDir, originalName);
      
      if (fs.existsSync(originalPath)) {
        const original = fs.readFileSync(originalPath);
        const matches = Buffer.compare(decrypted, original) === 0;
        console.log(`🔍 원본과 비교: ${matches ? '✅ 일치' : '❌ 불일치'}`);
        
        if (!matches) {
          console.log(`   - 원본 크기: ${original.length} bytes`);
          console.log(`   - 복호화된 크기: ${decrypted.length} bytes`);
        }
      } else {
        console.log(`⚠️ 원본 파일 없음: ${originalPath}`);
      }
      
    } catch (error) {
      console.error(`❌ 처리 실패: ${filename}`);
    }
  });
  
  console.log('\n✨ 검증 완료!');
}

// 스크립트 실행
if (require.main === module) {
  main();
}