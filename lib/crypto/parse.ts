/**
 * 암호화된 이미지 파일(.aeia, .aeiw) 파서
 * 파일 포맷: [4B: magic] + [12B: IV] + [1,048,576B: cipher] + [16B: tag] + [나머지: tail]
 */

export interface ParsedAeFile {
  format: "aeia" | "aeiw";
  iv: Uint8Array;
  cipher: Uint8Array;
  tag: Uint8Array;
  tail: Uint8Array;
}

export function parseAe(bytes: Uint8Array, filename?: string): ParsedAeFile {
  console.log(`📋 파일 파싱 시작: ${bytes.length} bytes (${filename || 'unknown'})`);
  
  // REF-A-2002 스펙: Format(4) + IV(12) + Ciphertext(1MB) + Tag(16) + Plane Tail
  if (bytes.length < 4) {
    throw new Error("파일이 너무 작습니다: magic header 부족");
  }

  // magic header 안전하게 파싱
  let magic: string;
  try {
    // 바이너리 데이터를 안전하게 ASCII로 디코딩
    magic = new TextDecoder('ascii', { fatal: true }).decode(bytes.slice(0, 4));
    console.log(`🔍 Magic header 파싱: "${magic}" (hex: ${Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')})`);
  } catch (decodeError) {
    // ASCII 디코딩 실패 시 수동으로 처리
    magic = String.fromCharCode(...bytes.slice(0, 4));
    console.log(`⚠️ Magic header fallback: "${magic}" (hex: ${Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')})`);
  }
  
  // magic header 검증
  if (magic !== "aeia" && magic !== "aeiw") {
    console.error(`❌ 파일 헤더 분석:`);
    console.error(`  - 기대값: "aeia" 또는 "aeiw"`);
    console.error(`  - 실제값: "${magic}"`);
    console.error(`  - 헤더 hex: ${Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    console.error(`  - 헤더 바이트: [${Array.from(bytes.slice(0, 4)).join(', ')}]`);
    
    throw new Error(`잘못된 파일 포맷: "${magic}". aeia 또는 aeiw만 지원됩니다.`);
  }

  const headerSize = 4 + 12; // magic(Format) + IV
  const cipherSize = 1_048_576; // 1MB
  const tagSize = 16;
  const minFileSize = headerSize + cipherSize + tagSize;

  if (bytes.length < minFileSize) {
    // 작은 파일의 경우, 실제 파일 크기에 맞춰 cipher 크기 조정
    const availableCipherSize = bytes.length - headerSize - tagSize;
    if (availableCipherSize <= 0) {
      throw new Error(`파일 크기 부족: ${bytes.length}bytes, 최소 ${headerSize + tagSize}bytes 필요`);
    }
    console.log(`⚠️ 파일이 1MB보다 작음, cipher 크기를 ${availableCipherSize}bytes로 조정`);
  }

  const iv = bytes.slice(4, headerSize);
  const cipherStart = headerSize;
  const actualCipherSize = Math.min(cipherSize, bytes.length - headerSize - tagSize);
  const cipherEnd = cipherStart + actualCipherSize;
  const cipher = bytes.slice(cipherStart, cipherEnd);
  const tag = bytes.slice(cipherEnd, cipherEnd + tagSize);
  const tail = bytes.slice(cipherEnd + tagSize);

  console.log(`📋 파싱 결과 (REF-A-2002 스펙):`);
  console.log(`  - Format: "${magic}" (4 bytes)`);
  console.log(`  - IV: ${iv.length} bytes (hex: ${Array.from(iv.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}...)`);
  console.log(`  - Cipher: ${cipher.length} bytes`);
  console.log(`  - Tag: ${tag.length} bytes (hex: ${Array.from(tag.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}...)`);
  console.log(`  - Tail: ${tail.length} bytes`);
  
  // 상세 정보 추가 로깅
  console.log(`🔍 파싱 상세 정보:`);
  console.log(`  - 전체 파일 크기: ${bytes.length} bytes`);
  console.log(`  - 예상 최소 크기: ${headerSize + tagSize} bytes`);
  console.log(`  - cipher 사이즈 조정: ${actualCipherSize} bytes (max: ${cipherSize})`);

  const result = {
    format: magic as "aeia" | "aeiw",
    iv,
    cipher,
    tag,
    tail
  };
  
  console.log(`✅ 파싱 성공: ${magic} 파일`);
  return result;
}

