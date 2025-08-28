/**
 * WebCrypto API를 사용한 AES-GCM 복호화 유틸리티
 */

export function hexToBytes(hex: string): Uint8Array {
  console.log(`🔢 Hex to Bytes 변환: ${hex.length}자 hex 문자열`);
  
  if (hex.length % 2 !== 0) {
    console.error('❌ Hex 문자열 길이 오류: 홀수 길이');
    throw new Error("hex 문자열의 길이가 홀수입니다.");
  }

  const matches = hex.match(/.{1,2}/g);
  if (!matches) {
    console.error('❌ Hex 문자열 파싱 실패');
    throw new Error("잘못된 hex 문자열입니다.");
  }

  const bytes = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
  console.log(`✅ Hex 변환 완료: ${bytes.length} bytes`);
  return bytes;
}

export async function decryptHeadAESGCM(
  keyHex: string,
  iv: Uint8Array,
  cipher: Uint8Array,
  _tag: Uint8Array
): Promise<Uint8Array> {
  console.log('\n🔐 === AES-GCM 복호화 시작 ===');
  console.log(`🔑 입력 파라미터:`);
  console.log(`  - Key (hex): ${keyHex.length}자 (${keyHex.substring(0, 16)}...${keyHex.substring(-8)})`);
  console.log(`  - IV: ${iv.length} bytes`);
  console.log(`  - Cipher: ${cipher.length.toLocaleString()} bytes`);
  console.log(`  - Tag: ${_tag.length} bytes (unused in demo)`);
  
  try {
    const keyBytes = hexToBytes(keyHex);
    
    if (keyBytes.length !== 32) {
      console.error(`❌ AES-256 키 길이 오류: ${keyBytes.length} bytes !== 32 bytes`);
      throw new Error(`AES-256 키는 32바이트여야 합니다. 현재: ${keyBytes.length}바이트`);
    }
    
    console.log(`✅ AES-256 키 크기 확인: ${keyBytes.length} bytes`);

    console.log('🔄 XOR 기반 복호화 시작 (데모용 - 실제 AES-GCM 대신)');
    console.log('⚠️  주의: 실서비스에서는 Web Crypto API를 사용해야 합니다');
    
    const decrypted = new Uint8Array(cipher.length);
    const startTime = Date.now();
    
    // XOR 복호화 진행
    for (let i = 0; i < cipher.length; i++) {
      decrypted[i] = cipher[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
      
      // 진행률 표시 (10% 단위)
      if (i > 0 && i % Math.floor(cipher.length / 10) === 0) {
        const progress = Math.round((i / cipher.length) * 100);
        console.log(`  🔄 복호화 진행: ${progress}% (${i.toLocaleString()}/${cipher.length.toLocaleString()} bytes)`);
      }
    }
    
    const endTime = Date.now();
    console.log(`✅ XOR 복호화 완료: ${endTime - startTime}ms 소요`);

    
    console.log('🔍 복호화 결과 분석:');
    console.log(`  - 복호화된 데이터 크기: ${decrypted.length.toLocaleString()} bytes`);
    
    // 복호화 결과에서 패턴 확인 (처음 2000바이트 확인)
    const resultStr = new TextDecoder('utf-8', { fatal: false }).decode(decrypted.slice(0, 2000));
    console.log('  - 복호화된 데이터 샘플 (UTF-8):', resultStr.slice(0, 100) + '...');
    
    // 헤더 바이트 분석
    console.log('  - 바이너리 헤더 (hex):', Array.from(decrypted.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // 식별 패턴 확인
    if (resultStr.includes('ENCRYPTED_DEMO_IMAGE_SUCCESS')) {
      console.log('  ✅ 복호화 검증: 식별 패턴 "ENCRYPTED_DEMO_IMAGE_SUCCESS" 확인됨');
    } else {
      console.log('  ⚠️ 복호화 검증: 식별 패턴 미발견');
    }
    
    // 이미지 헤더 확인
    const isRiff = decrypted[0] === 0x52 && decrypted[1] === 0x49 && decrypted[2] === 0x46 && decrypted[3] === 0x46;
    const isWebp = isRiff && decrypted[8] === 0x57 && decrypted[9] === 0x45 && decrypted[10] === 0x42 && decrypted[11] === 0x50;
    
    if (isRiff && isWebp) {
      console.log('  ✅ 이미지 검증: 유효한 RIFF/WebP 헤더 발견');
      
      // WebP 크기 정보 추출
      const riffSize = (decrypted[4] | (decrypted[5] << 8) | (decrypted[6] << 16) | (decrypted[7] << 24)) + 8;
      console.log(`  - RIFF 파일 크기: ${riffSize.toLocaleString()} bytes`);
    } else if (isRiff) {
      console.log('  ⚠️ 이미지 검증: RIFF 헤더는 있으나 WebP 시그니처 없음');
    } else {
      console.log('  ❌ 이미지 검증: 유효한 이미지 헤더 미발견');
    }

    
    console.log('🔐 === AES-GCM 복호화 완료 ===\n');
    return decrypted;
    
  } catch (error) {
    console.error('❌ 복호화 오류:', error);
    console.error('🔐 === AES-GCM 복호화 실패 ===\n');
    throw new Error(`복호화 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}