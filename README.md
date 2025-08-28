# 암호화 이미지 렌더링 PoC

AES-GCM으로 암호화된 AVIF/WebP 이미지를 WebCrypto API로 복호화하여 Canvas에 렌더링하는 Next.js 15 기반 데모입니다.

## 기능 개요

- 암호화된 이미지 파일(.aeia, .aeiw) 파싱 및 복호화
- WebCrypto API를 사용한 AES-GCM 복호화
- createImageBitmap과 Canvas API를 사용한 이미지 렌더링
- AVIF 실패 시 WebP로 자동 fallback
- Cache Storage API를 사용한 암호화된 원본 파일 캐싱

## 파일 포맷

```
[4B: magic("aeia"|"aeiw")] + [12B: IV] + [1,048,576B: cipher] + [16B: tag] + [나머지: tail(평문)]
```

- `aeia`: AVIF 형식의 암호화된 이미지
- `aeiw`: WebP 형식의 암호화된 이미지

## 프로젝트 구조

```
├── app/
│   ├── globals.css          # Tailwind CSS 설정
│   ├── layout.tsx          # 루트 레이아웃
│   └── page.tsx            # 메인 페이지 (UI 및 로직)
├── lib/
│   ├── cache/
│   │   └── store.ts        # Cache Storage API 유틸
│   ├── crypto/
│   │   ├── decrypt.ts      # AES-GCM 복호화 유틸
│   │   └── parse.ts        # 암호화된 파일 파서
│   └── image/
│       └── render.ts       # Canvas 렌더링 유틸
├── public/
│   └── sample.aeia         # 샘플 암호화 이미지 (직접 추가)
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
└── .eslintrc.json
```

## 실행 방법

### 1. 의존성 설치

```bash
# pnpm 사용 (권장)
pnpm install

# 또는 npm 사용
npm install

# 또는 yarn 사용
yarn install
```

### 2. 샘플 파일 추가

`public/sample.aeia` 파일을 프로젝트의 `public` 폴더에 배치하세요.

### 3. 개발 서버 실행

```bash
# pnpm 사용
pnpm dev

# 또는 npm 사용
npm run dev

# 또는 yarn 사용
yarn dev
```

### 4. 브라우저에서 접속

http://localhost:3000 으로 접속하여 데모를 확인하세요.

## 사용법

1. **파일에서 로드**: `/sample.aeia` 파일을 fetch하여 복호화 후 canvas에 렌더링
2. **캐시에 저장**: 암호화된 원본 파일을 Cache Storage API에 저장
3. **캐시에서 로드**: 캐시된 암호화 파일을 불러와서 복호화 후 렌더링

## 검증/테스트

### AVIF/WebP Fallback 테스트

1. AVIF를 지원하지 않는 브라우저에서 `.aeia` 파일 로드 시 자동으로 WebP로 해석 시도
2. 브라우저 개발자 도구 콘솔에서 fallback 로그 확인

### Cache Storage 확인

1. 브라우저 개발자 도구 → Application 탭 → Storage → Cache Storage
2. `img-encrypted-v1` 캐시 확인
3. 저장된 암호화 원본 파일 확인

## 빌드 및 배포

```bash
# 타입 체크
pnpm type-check

# ESLint 검사
pnpm lint

# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

## 흔한 이슈 및 해결 방법

### 1. createImageBitmap 지원 이슈

**증상**: `createImageBitmap is not defined` 에러

**해결**: 최신 브라우저에서 테스트하거나 polyfill 사용을 고려하세요.

### 2. MIME 타입 문제

**증상**: 이미지가 렌더링되지 않음

**해결**: 
- AVIF 지원 브라우저: Chrome 85+, Firefox 93+
- WebP 지원 브라우저: 대부분의 모던 브라우저
- Blob 생성 시 올바른 MIME 타입 지정 확인

### 3. 파일 경로 이슈

**증상**: 404 에러로 파일을 찾을 수 없음

**해결**: 
- Next.js의 `public/` 폴더에 파일 배치
- 브라우저에서 `http://localhost:3000/sample.aeia` 직접 접근하여 파일 존재 확인

### 4. CORS 문제

**증상**: 외부 서버에서 파일 로드 시 CORS 에러

**해결**: 
- 로컬 정적 파일은 문제없음
- 외부 서버 연동 시 적절한 CORS 헤더 설정 필요

### 5. 복호화 실패

**증상**: "복호화 실패" 에러

**해결**:
- AES 키가 정확한 32바이트 hex 문자열인지 확인
- IV, cipher, tag 데이터가 올바르게 파싱되었는지 확인
- 파일이 손상되지 않았는지 확인

## 보안 주의사항

⚠️ **경고**: 이 데모는 AES 키가 하드코딩되어 있습니다.

실제 서비스에서는 다음과 같은 보안 조치가 필요합니다:

- KMS(Key Management Service) 사용
- 토큰 기반 키 교환
- 세션별 키 파생
- 적절한 키 순환(rotation) 정책
- 키를 클라이언트 코드에 노출하지 않기

## 기술 스택

- **Frontend**: Next.js 15 (App Router), TypeScript
- **Styling**: Tailwind CSS
- **Crypto**: Web Crypto API (AES-GCM)
- **Image**: createImageBitmap, Canvas API
- **Cache**: Cache Storage API