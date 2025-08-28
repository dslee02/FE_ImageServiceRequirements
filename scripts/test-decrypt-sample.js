const fs = require('fs');
const { webcrypto } = require('crypto');
const path = require('path');

/**
 * 생성된 암호화 샘플 파일을 복호화하여 테스트
 */
async function testDecryptSample() {
  try {
    console.log('🔓 === 암호화된 샘플 복호화 테스트 시작 ===');
    
    // 파일 경로 설정
    const encryptedPath = path.join(__dirname, '../public/encrypted-sample.aeiw');
    const infoPath = path.join(__dirname, '../public/encrypted-sample-info.json');
    const outputPath = path.join(__dirname, '../public/decrypted-sample.jpeg');
    
    // 암호화 정보 읽기
    if (!fs.existsSync(infoPath)) {
      throw new Error(`암호화 정보 파일을 찾을 수 없습니다: ${infoPath}`);
    }
    
    const cryptoInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    console.log('📋 암호화 정보 로드:');
    console.log(`  Key: ${cryptoInfo.keyHex}`);
    console.log(`  IV: ${cryptoInfo.ivHex}`);
    console.log(`  Tag: ${cryptoInfo.tagHex}`);
    
    // 암호화된 파일 읽기
    if (!fs.existsSync(encryptedPath)) {
      throw new Error(`암호화 파일을 찾을 수 없습니다: ${encryptedPath}`);
    }
    
    const encryptedBuffer = fs.readFileSync(encryptedPath);
    console.log(`📊 암호화 파일 크기: ${encryptedBuffer.length.toLocaleString()} bytes`);
    
    // 파일 파싱 (magic + iv + cipher + tag + tail)
    let offset = 0;
    
    const magic = encryptedBuffer.slice(offset, offset + 4);
    offset += 4;
    console.log(`🏷️ Magic: ${magic.toString('ascii')}`);
    
    const iv = encryptedBuffer.slice(offset, offset + 12);
    offset += 12;
    console.log(`🔀 IV: ${iv.toString('hex')}`);
    
    const cipher = encryptedBuffer.slice(offset, offset + cryptoInfo.headSize);
    offset += cryptoInfo.headSize;
    console.log(`🔐 Cipher 크기: ${cipher.length.toLocaleString()} bytes`);
    
    const tag = encryptedBuffer.slice(offset, offset + 16);
    offset += 16;
    console.log(`🏷️ Tag: ${tag.toString('hex')}`);
    
    const tail = encryptedBuffer.slice(offset);
    console.log(`📄 Tail 크기: ${tail.length.toLocaleString()} bytes`);
    
    // WebCrypto API로 복호화
    console.log('🔄 WebCrypto API 복호화 시작...');
    
    const keyBuffer = Buffer.from(cryptoInfo.keyHex, 'hex');
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // cipher + tag를 연결
    const cipherWithTag = Buffer.concat([cipher, tag]);
    console.log(`🔗 Cipher+Tag 크기: ${cipherWithTag.length.toLocaleString()} bytes`);
    
    const decrypted = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      cipherWithTag
    );
    
    const decryptedBuffer = Buffer.from(decrypted);
    console.log(`✅ 복호화 완료: ${decryptedBuffer.length.toLocaleString()} bytes`);
    
    // 원본 크기만큼만 잘라내기 (패딩 제거)
    const originalData = decryptedBuffer.slice(0, cryptoInfo.originalSize);
    console.log(`✂️ 패딩 제거: ${decryptedBuffer.length.toLocaleString()} → ${originalData.length.toLocaleString()} bytes`);
    
    // tail과 합치기
    const finalBuffer = Buffer.concat([originalData, tail]);
    console.log(`📊 최종 복호화 파일 크기: ${finalBuffer.length.toLocaleString()} bytes`);
    
    // 복호화된 파일 저장
    fs.writeFileSync(outputPath, finalBuffer);
    console.log(`💾 복호화된 파일 저장: ${outputPath}`);
    
    // 원본과 비교
    const originalPath = path.join(__dirname, '../public/sampleimage_01.jpeg');
    const originalBuffer = fs.readFileSync(originalPath);
    
    const isIdentical = Buffer.compare(originalBuffer, finalBuffer) === 0;
    console.log(`🔍 원본과 비교: ${isIdentical ? '✅ 동일' : '❌ 다름'}`);
    
    if (isIdentical) {
      console.log('🎉 복호화 성공! 원본 파일과 완전히 일치합니다.');
    } else {
      console.log('⚠️ 복호화된 파일이 원본과 다릅니다.');
      console.log(`  원본 크기: ${originalBuffer.length.toLocaleString()} bytes`);
      console.log(`  복호화 크기: ${finalBuffer.length.toLocaleString()} bytes`);
    }
    
    console.log('🔓 === 암호화된 샘플 복호화 테스트 완료 ===\n');
    
  } catch (error) {
    console.error('❌ 복호화 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testDecryptSample();
}

module.exports = { testDecryptSample };