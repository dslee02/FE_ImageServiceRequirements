const fs = require('fs');
const { webcrypto } = require('crypto');
const path = require('path');

/**
 * 여러 WebP 샘플 이미지를 AES-GCM-256으로 암호화하여 .aeiw 파일로 생성
 * 스펙: magic(4) + iv(12) + cipher(1MB) + tag(16) + tail(나머지)
 */
async function encryptWebpSamples() {
  try {
    console.log('🔐 === WebP 샘플 이미지들 암호화 시작 ===');
    
    // 암호화할 WebP 파일들
    const webpFiles = [
      'file_example_WEBP_50kB.webp',
      'file_example_WEBP_1500kB.webp'
    ];
    
    for (const fileName of webpFiles) {
      console.log(`\n📂 처리 중: ${fileName}`);
      
      // 파일 경로 설정
      const inputPath = path.join(__dirname, '../public', fileName);
      const outputPath = path.join(__dirname, '../public', `encrypted-${fileName.replace('.webp', '')}.aeiw`);
      
      // 32바이트(256비트) 랜덤 키 생성
      const keyHex = Array.from(webcrypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      console.log(`🔑 생성된 키: ${keyHex}`);
      console.log(`📂 입력 파일: ${inputPath}`);
      console.log(`📂 출력 파일: ${outputPath}`);
      
      // 파일 읽기
      if (!fs.existsSync(inputPath)) {
        console.error(`❌ 입력 파일을 찾을 수 없습니다: ${inputPath}`);
        continue;
      }
      
      const fileBuffer = fs.readFileSync(inputPath);
      console.log(`📊 원본 파일 크기: ${fileBuffer.length.toLocaleString()} bytes`);
      
      // WebP 확장자이므로 'aeiw' 매직 사용
      const magic = Buffer.from('aeiw');
      
      // 12바이트 랜덤 IV 생성
      const iv = webcrypto.getRandomValues(new Uint8Array(12));
      console.log(`🔀 IV: ${Buffer.from(iv).toString('hex')}`);
      
      // 키를 Buffer로 변환
      const keyBuffer = Buffer.from(keyHex, 'hex');
      
      // 파일을 head(1MB)와 tail(나머지)로 분할
      const headSize = 1048576; // 고정 1MB
      
      // 항상 1MB 크기의 head 생성 (패딩 포함)
      const head = new Uint8Array(headSize);
      let tail = new Uint8Array(0);
      
      if (fileBuffer.length >= headSize) {
        // 파일이 1MB 이상인 경우: 앞 1MB만 head로, 나머지는 tail로
        head.set(fileBuffer.slice(0, headSize), 0);
        tail = fileBuffer.slice(headSize);
        console.log(`📊 파일이 1MB 이상: head=${headSize.toLocaleString()} bytes, tail=${tail.length.toLocaleString()} bytes`);
      } else {
        // 파일이 1MB 미만인 경우: 전체 파일을 head에 넣고 나머지는 0으로 패딩
        head.set(fileBuffer, 0);
        console.log(`📏 파일이 1MB보다 작아서 패딩 추가: ${fileBuffer.length.toLocaleString()} → ${headSize.toLocaleString()} bytes`);
      }
      
      // WebCrypto API로 키 가져오기
      const cryptoKey = await webcrypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      console.log('🔄 AES-GCM 암호화 진행 중...');
      
      // AES-GCM 암호화 수행
      const encrypted = await webcrypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        head
      );
      
      // encrypted = cipher + tag 형태로 반환됨
      const encryptedBuffer = Buffer.from(encrypted);
      const cipher = encryptedBuffer.slice(0, head.length);
      const tag = encryptedBuffer.slice(head.length);
      
      console.log(`📊 암호화된 데이터 크기: ${cipher.length.toLocaleString()} bytes`);
      console.log(`📊 인증 태그 크기: ${tag.length} bytes`);
      console.log(`🏷️ 태그: ${tag.toString('hex')}`);
      
      // 최종 파일 구성: magic + iv + cipher + tag + tail
      const finalBuffer = Buffer.concat([
        magic,           // 4 bytes
        Buffer.from(iv), // 12 bytes  
        cipher,          // head.length bytes
        tag,             // 16 bytes
        tail             // 나머지
      ]);
      
      console.log(`📊 최종 암호화 파일 크기: ${finalBuffer.length.toLocaleString()} bytes`);
      
      // 파일 저장
      fs.writeFileSync(outputPath, finalBuffer);
      
      console.log('✅ 암호화 완료!');
      
      // 검증용 정보도 JSON 파일로 저장
      const cryptoInfo = {
        originalFile: fileName,
        keyHex,
        ivHex: Buffer.from(iv).toString('hex'),
        tagHex: tag.toString('hex'),
        originalSize: fileBuffer.length,
        encryptedSize: finalBuffer.length,
        headSize: head.length,
        tailSize: tail.length
      };
      
      const infoPath = path.join(__dirname, '../public', `encrypted-${fileName.replace('.webp', '')}-info.json`);
      fs.writeFileSync(infoPath, JSON.stringify(cryptoInfo, null, 2));
      console.log(`📄 암호화 정보 저장: ${infoPath}`);
      
      console.log('\n📋 복호화에 필요한 정보:');
      console.log(`Key (hex): ${keyHex}`);
      console.log(`IV (hex): ${Buffer.from(iv).toString('hex')}`);
      console.log(`Tag (hex): ${tag.toString('hex')}`);
    }
    
    console.log('\n🔐 === 모든 WebP 샘플 이미지 암호화 완료 ===\n');
    
  } catch (error) {
    console.error('❌ 암호화 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  encryptWebpSamples();
}

module.exports = { encryptWebpSamples };