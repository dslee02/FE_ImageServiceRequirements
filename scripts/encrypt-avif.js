const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 암호화 함수 (REF-A-2002 스펙 준수)
function encryptFile(inputPath, outputPath, keyHex) {
  try {
    console.log(`🔐 암호화 시작: ${inputPath} -> ${outputPath}`);
    
    // 키를 Buffer로 변환 (32 bytes = 256 bits)
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
      throw new Error(`잘못된 키 길이: ${key.length} bytes (32 bytes 필요)`);
    }
    
    // 원본 파일 읽기
    const data = fs.readFileSync(inputPath);
    console.log(`📁 원본 파일 크기: ${data.length} bytes`);
    
    // REF-A-2002 스펙: 1MB(1,048,576 bytes)만 암호화
    const ENCRYPT_SIZE = 1048576; // 1MB
    const dataToEncrypt = data.slice(0, Math.min(ENCRYPT_SIZE, data.length));
    const plainTail = data.slice(dataToEncrypt.length);
    
    console.log(`📋 파일 분할:`);
    console.log(`   - 암호화할 데이터: ${dataToEncrypt.length} bytes`);
    console.log(`   - 평문 tail: ${plainTail.length} bytes`);
    
    // 파일 확장자로 포맷 결정
    const format = outputPath.endsWith('.aeia') ? 'aeia' : 'aeiw';
    const formatBuffer = Buffer.from(format, 'ascii');
    
    // 12바이트 IV(Initialization Vector) 생성
    const iv = crypto.randomBytes(12);
    
    // AES-GCM 암호화 (Node.js 호환 방식)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // 데이터 암호화 (1MB만)
    const encrypted = Buffer.concat([
      cipher.update(dataToEncrypt),
      cipher.final()
    ]);
    
    // 인증 태그 가져오기
    const authTag = cipher.getAuthTag();
    
    // REF-A-2002 스펙에 따른 최종 구조: Format(4) + IV(12) + Ciphertext(1MB) + Tag(16) + Plane Tail
    const result = Buffer.concat([
      formatBuffer,      // 4 bytes: "aeia" or "aeiw"
      iv,               // 12 bytes: IV
      encrypted,        // 1MB max: 암호화된 데이터
      authTag,          // 16 bytes: Auth Tag
      plainTail         // 나머지: 평문
    ]);
    
    // 파일 저장
    fs.writeFileSync(outputPath, result);
    
    console.log(`✅ 암호화 완료! (REF-A-2002 스펙)`);
    console.log(`   - Format: ${format} (${formatBuffer.length} bytes)`);
    console.log(`   - IV 길이: ${iv.length} bytes`);
    console.log(`   - 암호화된 데이터: ${encrypted.length} bytes`);
    console.log(`   - AuthTag 길이: ${authTag.length} bytes`);
    console.log(`   - 평문 tail: ${plainTail.length} bytes`);
    console.log(`   - 총 파일 크기: ${result.length} bytes`);
    console.log(`   - 저장 위치: ${outputPath}`);
    
    return keyHex;
    
  } catch (error) {
    console.error(`❌ 암호화 실패: ${error.message}`);
    throw error;
  }
}

// 랜덤 키 생성
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 메인 실행
function main() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  // 파일 목록과 키
  const files = [
    {
      input: path.join(publicDir, 'file_example_AVIF_178kb.avif'),
      output: path.join(publicDir, 'encrypted-file_example_AVIF_178kb.aeia'),
      key: generateKey()
    },
    {
      input: path.join(publicDir, 'file_example_AVIF_1200kb.avif'),
      output: path.join(publicDir, 'encrypted-file_example_AVIF_1200kb.aeia'),
      key: generateKey()
    }
  ];
  
  console.log('🚀 AVIF 파일 암호화 시작\n');
  
  const keys = {};
  
  files.forEach((file, index) => {
    console.log(`\n=== 파일 ${index + 1}/${files.length} ===`);
    
    // 입력 파일 존재 확인
    if (!fs.existsSync(file.input)) {
      console.error(`❌ 입력 파일이 없습니다: ${file.input}`);
      return;
    }
    
    try {
      const keyUsed = encryptFile(file.input, file.output, file.key);
      const outputFilename = path.basename(file.output);
      keys[outputFilename] = keyUsed;
      
      console.log(`🔑 생성된 키: ${keyUsed}`);
      
    } catch (error) {
      console.error(`❌ 처리 실패: ${file.input}`);
    }
  });
  
  // 키 목록 출력
  console.log('\n' + '='.repeat(50));
  console.log('📋 생성된 암호화 키 목록 (app/page.tsx에 추가하세요):');
  console.log('='.repeat(50));
  
  Object.entries(keys).forEach(([filename, key]) => {
    console.log(`"${filename}": "${key}",`);
  });
  
  console.log('\n✨ 모든 작업이 완료되었습니다!');
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { encryptFile, generateKey };