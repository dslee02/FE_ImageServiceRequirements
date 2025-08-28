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

export function parseAe(bytes: Uint8Array): ParsedAeFile {
  if (bytes.length < 4) {
    throw new Error("파일이 너무 작습니다: magic header 부족");
  }

  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  
  if (magic !== "aeia" && magic !== "aeiw") {
    throw new Error(`잘못된 파일 포맷: ${magic}. aeia 또는 aeiw만 지원됩니다.`);
  }

  const headerSize = 4 + 12; // magic(Format) + IV
  const cipherSize = 1_048_576; // 1MB
  const tagSize = 16;
  const minFileSize = headerSize + cipherSize + tagSize;

  if (bytes.length < minFileSize) {
    throw new Error(`파일 크기 부족: ${bytes.length}bytes, 최소 ${minFileSize}bytes 필요`);
  }

  const iv = bytes.slice(4, headerSize);
  const cipherStart = headerSize;
  const cipherEnd = cipherStart + cipherSize;
  const cipher = bytes.slice(cipherStart, cipherEnd);
  const tag = bytes.slice(cipherEnd, cipherEnd + tagSize);
  const tail = bytes.slice(cipherEnd + tagSize);

  return {
    format: magic as "aeia" | "aeiw",
    iv,
    cipher,
    tag,
    tail
  };
}

