# 🎓 인턴개발자를 위한 암호화 이미지 프로젝트 가이드

이 문서는 암호화된 이미지 복호화 및 렌더링 프로젝트를 처음 접하는 인턴개발자를 위한 상세한 가이드입니다.

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [개발 환경 설정](#개발-환경-설정)
3. [핵심 개념 이해](#핵심-개념-이해)
4. [코드 아키텍처](#코드-아키텍처)
5. [단계별 구현 방법](#단계별-구현-방법)
6. [디버깅 가이드](#디버깅-가이드)
7. [테스트 방법](#테스트-방법)
8. [FAQ](#faq)

## 🎯 프로젝트 개요

### 무엇을 만들고 있는가?

AES-GCM 암호화로 보호된 이미지 파일을 브라우저에서 안전하게 복호화하고 표시하는 웹 애플리케이션입니다.

### 왜 이것이 필요한가?

- **보안**: 이미지 파일을 네트워크에서 암호화된 상태로 전송
- **저작권 보호**: 이미지를 직접 다운로드하거나 복사하기 어렵게 만듦
- **접근 제어**: 특정 키를 가진 사용자만 이미지 열람 가능

### 기술적 특징

- **Next.js 15**: 최신 React 프레임워크
- **TypeScript**: 타입 안전성
- **Web Crypto API**: 브라우저 내장 암호화 기능
- **Canvas API**: 이미지 렌더링
- **Cache Storage**: 효율적인 데이터 캐싱

## ⚙️ 개발 환경 설정

### 1. 필수 도구 설치

```bash
# Node.js 18+ 설치 확인
node --version

# pnpm 설치 (권장)
npm install -g pnpm
```

### 2. 프로젝트 클론 및 설정

```bash
# 프로젝트 디렉토리로 이동
cd FE_ImageServiceRequirements

# 의존성 설치
pnpm install

# 타입 체크
pnpm type-check

# 개발 서버 시작
pnpm dev
```

### 3. 개발 도구 설정

**VS Code 확장 추천:**
- TypeScript Hero
- Tailwind CSS IntelliSense
- Auto Rename Tag
- Prettier - Code formatter

**브라우저 설정:**
- Chrome DevTools의 Console, Network, Application 탭 활용
- AVIF 지원을 위해 Chrome 85+ 사용 권장

## 🧠 핵심 개념 이해

### 1. 암호화 파일 형식

```
┌─────────────┬──────────────┬─────────────────┬──────────────┬─────────────┐
│   Magic     │      IV      │     Cipher      │     Tag      │    Tail     │
│  (4 bytes)  │  (12 bytes)  │  (1MB 고정)    │  (16 bytes)  │  (가변)    │
├─────────────┼──────────────┼─────────────────┼──────────────┼─────────────┤
│ "aeia" 또는 │ 초기화 벡터  │ 암호화된 데이터 │ 인증 태그   │ 평문 데이터 │
│ "aeiw"      │             │                │             │            │
└─────────────┴──────────────┴─────────────────┴──────────────┴─────────────┘
```

### 2. AES-GCM 암호화

**AES-GCM이란?**
- Advanced Encryption Standard - Galois/Counter Mode
- 암호화 + 무결성 검증을 동시에 제공
- 브라우저 Web Crypto API에서 표준 지원

**주요 구성 요소:**
- **Key**: 32바이트(256비트) 암호화 키
- **IV**: 12바이트 초기화 벡터 (Nonce)
- **Tag**: 16바이트 인증 태그

### 3. Canvas와 ImageBitmap

**ImageBitmap이란?**
- 브라우저 내장 이미지 디코딩 API
- 다양한 형식(AVIF, WebP, PNG, JPEG) 지원
- GPU 가속 가능

**Canvas 렌더링 프로세스:**
1. 복호화된 바이너리 데이터 → Blob 생성
2. Blob → ImageBitmap 변환
3. ImageBitmap → Canvas 렌더링

## 🏗️ 코드 아키텍처

### 디렉토리 구조 상세 설명

```
📁 프로젝트 루트
├── 📁 app/                    # Next.js 15 App Router
│   ├── 📄 layout.tsx         # 전체 레이아웃 (HTML 구조)
│   ├── 📄 page.tsx           # 메인 페이지 (UI + 비즈니스 로직)
│   └── 📄 globals.css        # 전역 스타일 (Tailwind)
├── 📁 lib/                   # 핵심 비즈니스 로직
│   ├── 📁 crypto/            # 암호화 관련
│   │   ├── 📄 parse.ts       # 파일 파싱 (Magic, IV, Cipher, Tag 추출)
│   │   └── 📄 decrypt.ts     # AES-GCM 복호화
│   ├── 📁 image/            # 이미지 처리
│   │   ├── 📄 render.ts     # Canvas 렌더링 (AVIF/WebP)
│   │   └── 📄 metadata.ts   # 이미지 메타데이터
│   └── 📁 cache/            # 캐싱
│       └── 📄 store.ts      # Cache Storage API 래퍼
├── 📁 components/           # React 컴포넌트
│   ├── 📄 EncryptedImage.tsx # 암호화 이미지 렌더링 컴포넌트
│   └── 📄 GeneralImage.tsx   # 일반 이미지 컴포넌트
└── 📁 scripts/              # 유틸리티 스크립트
    ├── 📄 create-encrypted-sample.js # 샘플 암호화 파일 생성
    └── 📄 test-decrypt.js           # 복호화 테스트
```

### 주요 파일 역할

| 파일 | 역할 | 입력 | 출력 |
|------|------|------|------|
| `parse.ts` | 파일 파싱 | 암호화된 바이너리 | Magic, IV, Cipher, Tag, Tail |
| `decrypt.ts` | 복호화 | IV, Cipher, Tag, Key | 복호화된 바이너리 |
| `render.ts` | 렌더링 | 복호화된 이미지 바이너리 | Canvas에 그려진 이미지 |
| `EncryptedImage.tsx` | UI 컴포넌트 | contentId, baseUrl, aesKey | 렌더링된 React 엘리먼트 |

## 🔧 단계별 구현 방법

### Step 1: 파일 파싱 구현

```typescript
// lib/crypto/parse.ts
export interface ParsedAe {
  format: "aeia" | "aeiw";
  iv: Uint8Array;        // 12 바이트
  cipher: Uint8Array;    // 1MB
  tag: Uint8Array;       // 16 바이트
  tail: Uint8Array;      // 나머지
}

export function parseAe(fileData: Uint8Array): ParsedAe {
  // 1. Magic 확인 (처음 4바이트)
  const magicBytes = fileData.slice(0, 4);
  const magic = new TextDecoder().decode(magicBytes);
  
  if (magic !== "aeia" && magic !== "aeiw") {
    throw new Error(`잘못된 Magic: ${magic}`);
  }

  // 2. 각 섹션 추출
  const iv = fileData.slice(4, 16);         // 4~15 (12바이트)
  const cipher = fileData.slice(16, 1048592); // 16~1048591 (1MB)
  const tag = fileData.slice(1048592, 1048608); // 1048592~1048607 (16바이트)
  const tail = fileData.slice(1048608);     // 나머지

  return {
    format: magic as "aeia" | "aeiw",
    iv,
    cipher, 
    tag,
    tail
  };
}
```

### Step 2: AES-GCM 복호화 구현

```typescript
// lib/crypto/decrypt.ts
export async function decryptHeadAESGCM(
  iv: Uint8Array,
  cipher: Uint8Array, 
  tag: Uint8Array,
  keyHex: string
): Promise<Uint8Array> {
  // 1. Hex 문자열을 바이너리로 변환
  const keyBuffer = new Uint8Array(
    keyHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
  );

  // 2. CryptoKey 생성
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    "AES-GCM",
    false,
    ["decrypt"]
  );

  // 3. 복호화 데이터 준비 (cipher + tag)
  const encryptedData = new Uint8Array(cipher.length + tag.length);
  encryptedData.set(cipher, 0);
  encryptedData.set(tag, cipher.length);

  // 4. 복호화 실행
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128  // 16 bytes = 128 bits
    },
    cryptoKey,
    encryptedData
  );

  return new Uint8Array(decrypted);
}
```

### Step 3: 이미지 렌더링 구현

```typescript
// lib/image/render.ts
export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  fullBytes: Uint8Array,
  format: "aeia" | "aeiw"
): Promise<void> {
  // 1. 이미지 형식 검증
  const hasRiff = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && 
                  fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
  const hasWebp = hasRiff && fullBytes[8] === 0x57 && 
                  fullBytes[9] === 0x45 && fullBytes[10] === 0x42 && 
                  fullBytes[11] === 0x50;

  // 2. WebP 크기 추출
  let imageData = fullBytes;
  if (hasRiff && hasWebp) {
    const riffSize = (fullBytes[4] | (fullBytes[5] << 8) | 
                     (fullBytes[6] << 16) | (fullBytes[7] << 24)) + 8;
    if (riffSize <= fullBytes.length) {
      imageData = fullBytes.slice(0, riffSize);
    }
  }

  // 3. AVIF/WebP fallback으로 디코딩
  let bitmap: ImageBitmap;
  try {
    // AVIF 시도
    const avifBlob = new Blob([imageData], { type: "image/avif" });
    bitmap = await createImageBitmap(avifBlob);
  } catch {
    // WebP 시도
    const webpBlob = new Blob([imageData], { type: "image/webp" });
    bitmap = await createImageBitmap(webpBlob);
  }

  // 4. Canvas에 렌더링
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  
  bitmap.close();
}
```

### Step 4: React 컴포넌트 구현

```typescript
// components/EncryptedImage.tsx
export default function EncryptedImage({
  contentId,
  baseUrl, 
  aesKey,
  className,
  alt
}: EncryptedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        
        // 1. 파일 다운로드
        const response = await fetch(`${baseUrl}/${contentId}.aeia`);
        const arrayBuffer = await response.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        // 2. 파일 파싱
        const parsed = parseAe(fileData);
        
        // 3. 복호화
        const decryptedHead = await decryptHeadAESGCM(
          parsed.iv,
          parsed.cipher, 
          parsed.tag,
          aesKey
        );

        // 4. 전체 이미지 데이터 조합
        const fullImage = new Uint8Array(
          decryptedHead.length + parsed.tail.length
        );
        fullImage.set(decryptedHead, 0);
        fullImage.set(parsed.tail, decryptedHead.length);

        // 5. Canvas 렌더링
        if (canvasRef.current) {
          await renderToCanvas(canvasRef.current, fullImage, parsed.format);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        setLoading(false);
      }
    };

    loadImage();
  }, [contentId, baseUrl, aesKey]);

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error}</div>;

  return (
    <canvas 
      ref={canvasRef}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}
```

## 🐛 디버깅 가이드

### 1. 브라우저 개발자 도구 활용

**Console 탭에서 확인할 로그:**
```
Canvas 렌더링 시작 - 데이터 크기: 1048576 bytes, 포맷: aeiw
이미지 형식 확인: RIFF=true, WebP=true, AVIF=false, JPEG=false
🔄 1차 시도: AVIF 형식으로 디코딩 (50404 bytes)
AVIF 디코딩 실패: [에러 객체]
🔄 2차 시도: WebP 형식으로 디코딩 (50404 bytes)
✅ WebP 디코딩 성공
✅ Canvas 렌더링 완료 - 크기: 512x512
```

**Network 탭에서 확인:**
- 파일 다운로드 상태 (200 OK인지)
- 파일 크기가 예상과 같은지
- CORS 에러가 없는지

**Application 탭에서 확인:**
- Cache Storage → `img-encrypted-v1`
- 캐시된 파일들과 크기

### 2. 일반적인 문제와 해결법

| 문제 | 증상 | 해결 방법 |
|------|------|----------|
| **파일을 찾을 수 없음** | Network에서 404 | `public/` 폴더에 파일 배치 확인 |
| **복호화 실패** | "OperationError" | AES 키 32바이트 hex 확인 |
| **이미지 렌더링 실패** | "InvalidStateError" | 이미지 데이터 무결성 확인 |
| **Canvas 빈 화면** | 렌더링은 성공하지만 보이지 않음 | Canvas 크기나 CSS 확인 |
| **타입 에러** | TypeScript 컴파일 실패 | `pnpm type-check` 실행 후 수정 |

### 3. 단계별 디버깅 체크리스트

**파일 로딩 단계:**
- [ ] 파일 경로가 올바른가?
- [ ] 파일 크기가 예상과 같은가?
- [ ] CORS 설정이 올바른가?

**파싱 단계:**
- [ ] Magic 바이트가 "aeia" 또는 "aeiw"인가?
- [ ] IV가 12바이트인가?
- [ ] Tag가 16바이트인가?
- [ ] Cipher가 1MB인가?

**복호화 단계:**
- [ ] AES 키가 64자리 hex 문자열인가?
- [ ] Web Crypto API가 지원되는 브라우저인가?
- [ ] HTTPS 환경에서 실행 중인가? (localhost는 예외)

**렌더링 단계:**
- [ ] Canvas 요소가 DOM에 존재하는가?
- [ ] ImageBitmap이 성공적으로 생성되었는가?
- [ ] Canvas 크기가 올바르게 설정되었는가?

## 🧪 테스트 방법

### 1. 단위 테스트

각 함수를 독립적으로 테스트:

```typescript
// 파싱 테스트
const testFile = new Uint8Array([
  // Magic: "aeiw"
  0x61, 0x65, 0x69, 0x77,
  // IV: 12 bytes
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C,
  // ... cipher (1MB) + tag (16bytes)
]);

const parsed = parseAe(testFile);
console.assert(parsed.format === "aeiw", "Magic 파싱 실패");
console.assert(parsed.iv.length === 12, "IV 길이 오류");
```

### 2. 통합 테스트

전체 플로우를 브라우저에서 테스트:

1. **정상 케이스**: 올바른 암호화 파일 + 올바른 키
2. **잘못된 키**: 올바른 파일 + 잘못된 키 → 복호화 실패
3. **손상된 파일**: 일부 바이트가 변조된 파일 → 파싱 또는 복호화 실패
4. **네트워크 오류**: 존재하지 않는 파일 → 404 오류

### 3. 브라우저 호환성 테스트

| 브라우저 | AVIF 지원 | WebP 지원 | Web Crypto | 비고 |
|----------|-----------|-----------|------------|------|
| Chrome 85+ | ✅ | ✅ | ✅ | 권장 |
| Firefox 93+ | ✅ | ✅ | ✅ | 권장 |
| Safari 14+ | ❌ | ✅ | ✅ | WebP만 지원 |
| Edge 85+ | ✅ | ✅ | ✅ | Chromium 기반 |

## ❓ FAQ

### Q1: "createImageBitmap is not defined" 에러가 발생해요

**A:** 이 API는 최신 브라우저에서만 지원됩니다. Chrome 85+ 또는 Firefox 93+ 사용을 권장합니다.

### Q2: 복호화는 성공하는데 이미지가 보이지 않아요

**A:** 여러 가능성이 있습니다:
1. 복호화된 데이터가 실제로는 유효한 이미지가 아님
2. AVIF/WebP 헤더가 손상됨
3. Canvas CSS가 `display: none` 등으로 숨겨져 있음

콘솔에서 복호화된 데이터의 첫 32바이트를 확인해보세요.

### Q3: CORS 에러가 계속 발생해요

**A:** 
- 로컬 개발: `next dev`로 개발 서버 사용
- 프로덕션: 이미지 파일과 동일한 도메인에서 서빙
- 외부 서버: 적절한 CORS 헤더 설정 필요

### Q4: TypeScript 에러를 어떻게 해결하나요?

**A:**
```bash
# 타입 체크 실행
pnpm type-check

# 일반적인 해결책
- Uint8Array 타입 불일치 → new Uint8Array() 명시적 생성
- 비동기 함수 → async/await 올바른 사용
- null/undefined → optional chaining(?.) 사용
```

### Q5: 성능을 어떻게 개선할 수 있나요?

**A:**
1. **캐싱 활용**: Cache Storage API로 파일 재사용
2. **이미지 최적화**: 작은 크기의 WebP/AVIF 사용
3. **지연 로딩**: Intersection Observer로 필요할 때만 로드
4. **Web Worker**: 복호화 작업을 별도 스레드에서 실행

### Q6: 보안을 어떻게 강화할 수 있나요?

**A:**
- 키를 코드에 하드코딩하지 말고 서버에서 동적으로 받기
- HTTPS 필수 (Web Crypto API 요구사항)
- CSP(Content Security Policy) 설정
- 키 순환(rotation) 정책 수립

---

## 🎉 마무리

이 가이드를 따라하면 암호화된 이미지 처리 시스템을 완전히 이해하고 구현할 수 있습니다. 

**다음 단계:**
1. 기본 기능 구현 완료 후 추가 기능 고려 (썸네일, 메타데이터 등)
2. 성능 최적화 및 사용자 경험 개선
3. 보안 강화 및 프로덕션 배포 준비

**참고 자료:**
- [Web Crypto API MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Canvas API MDN 문서](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Next.js 공식 문서](https://nextjs.org/docs)

질문이 있으면 언제든 물어보세요! 🚀