# 🛡️ REF-A-2002 암호화 이미지 서비스 PoC (완전 구현)

REF-A-2002 스펙을 완전히 준수하는 암호화 이미지 처리 시스템입니다. AES-GCM-256으로 암호화된 AVIF/WebP 이미지를 WebCrypto API로 복호화하여 Canvas에 렌더링하는 Next.js 15 기반 프로덕션급 데모를 제공합니다.

## ✨ 주요 달성 사항

- ✅ **REF-A-2002 완전 구현**: Format(4) + IV(12) + Ciphertext(1MB) + Tag(16) + Plane Tail
- ✅ **WebCrypto AES-GCM-256**: 브라우저 표준 암호화 API 완전 활용
- ✅ **다단계 Fallback 렌더링**: AVIF→WebP→Image객체→Base64→성공메시지
- ✅ **지능형 캐시 시스템**: 개발/프로덕션 환경별 정책, 캐시 오염 방지
- ✅ **강화된 상태 관리**: AbortController 기반 요청 취소, 컴포넌트 정리
- ✅ **완벽한 에러 처리**: 상세 로깅, hex dump, 트러블슈팅 지원
- ✅ **동적 파일 스캔**: API 기반 이미지 자동 감지
- ✅ **UI/UX 최적화**: 로딩 상태, 에러 표시, AVIF 지원 확인

## 📋 REF-A-2002 스펙 완전 준수

### 파일 포맷 구조
```
[4B: Format("aeia"|"aeiw")] + [12B: IV] + [최대 1MB: Ciphertext] + [16B: AuthTag] + [가변: Plane Tail]
```

- **Format** (4 bytes): `aeia` (AVIF) 또는 `aeiw` (WebP)
- **IV** (12 bytes): AES-GCM Nonce (초기화 벡터)
- **Ciphertext** (가변, 최대 1MB): 암호화된 이미지 헤더 부분
- **AuthTag** (16 bytes): AES-GCM 인증 태그
- **Plane Tail** (가변): 평문으로 저장되는 나머지 이미지 데이터

### 지원 형식
- ✅ **AEIA**: AVIF 형식 암호화 이미지 (고효율 압축)
- ✅ **AEIW**: WebP 형식 암호화 이미지 (호환성 우수)

## 🏗️ 프로젝트 구조 (현재 버전)

```
├── app/
│   ├── api/images/
│   │   └── route.ts        # 동적 이미지 스캔 API
│   ├── globals.css          # Tailwind CSS 설정
│   ├── layout.tsx          # 루트 레이아웃
│   └── page.tsx            # 메인 페이지 (강화된 상태 관리)
├── components/
│   ├── EncryptedImage.tsx  # 암호화 이미지 컴포넌트 (AbortController 지원)
│   └── GeneralImage.tsx    # 일반 이미지 컴포넌트
├── lib/
│   ├── cache/
│   │   └── store.ts        # 지능형 캐시 시스템 (환경별 정책)
│   ├── crypto/
│   │   ├── decrypt.ts      # WebCrypto AES-GCM-256 복호화
│   │   └── parse.ts        # REF-A-2002 스펙 파서 (상세 로깅)
│   └── image/
│       ├── render.ts       # 다단계 Canvas 렌더링 (고급 fallback)
│       └── metadata.ts     # AVIF 지원 검사
├── scripts/
│   ├── encrypt-avif.js     # AVIF 암호화 스크립트 (REF-A-2002)
│   └── encrypt-webp.js     # WebP 암호화 스크립트
├── md/
│   ├── INTERN_GUIDE.md     # 인턴 개발자 가이드
│   └── IMPLEMENTATION_GUIDE.md # 단계별 구현 가이드
├── public/
│   ├── *.aeia              # AVIF 암호화 샘플 파일들
│   ├── *.aeiw              # WebP 암호화 샘플 파일들
│   └── *.avif, *.webp      # 일반 이미지 파일들
├── TROUBLESHOOTING_GUIDE.md # 완벽한 트러블슈팅 가이드
└── 기타 설정 파일들...
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

## 🚀 고급 기능 및 사용법

### 1. 다단계 이미지 렌더링
- **1차**: createImageBitmap으로 AVIF 디코딩 시도
- **2차**: WebP fallback 디코딩
- **3차**: Image 객체 + Base64 방식
- **4차**: Blob URL 방식
- **최종**: 복호화 성공 메시지 표시

### 2. 지능형 캐시 관리
- **개발 모드**: 캐시 완전 비활성화 (캐시 오염 방지)
- **프로덕션**: Cache Storage API 활용
- **수동 캐시 제어**: 브라우저 내 캐시 클리어 버튼

### 3. 동적 파일 관리
- **API 기반 스캔**: `/api/images`로 public 폴더 자동 스캔
- **메타데이터 추출**: 파일 크기, 형식, 암호화 여부 자동 감지
- **실시간 업데이트**: 파일 추가/삭제 시 자동 반영

### 4. 강화된 에러 처리
- **상세 로깅**: hex dump, 파일 구조 분석
- **AbortController**: 요청 취소 및 메모리 누수 방지
- **단계별 디버깅**: 파싱 → 복호화 → 렌더링 각 단계별 상태 추적

## 🧪 완벽한 검증 및 테스트

### REF-A-2002 스펙 준수 검증
1. **파일 구조 검증**: Format(4) + IV(12) + Cipher(1MB) + Tag(16) + Tail 구조 확인
2. **Magic Header 검증**: "aeia" / "aeiw" 정확한 파싱
3. **가변 Cipher 크기**: 1MB 미만 파일 처리 확인
4. **Plane Tail 처리**: 평문 영역 올바른 재조립

### 다단계 Fallback 테스트
1. **AVIF 지원**: 최신 브라우저에서 .aeia 파일 네이티브 디코딩
2. **WebP Fallback**: AVIF 미지원 시 자동 WebP 해석
3. **Image 객체 방식**: createImageBitmap 실패 시 Base64 방식
4. **최종 복호화 성공 표시**: 모든 렌더링 실패 시에도 복호화 성공 확인

### 캐시 시스템 검증
1. **개발 모드**: 캐시 완전 비활성화 확인 (콘솔 로그)
2. **프로덕션 모드**: Cache Storage 정상 동작
3. **캐시 오염 방지**: 잘못된 데이터로 인한 파싱 실패 해결
4. **수동 캐시 클리어**: 브라우저 내 버튼으로 즉시 정리

### 상태 관리 및 메모리 테스트
1. **AbortController**: 컴포넌트 언마운트 시 요청 취소
2. **메모리 누수 방지**: ImageBitmap 자동 정리
3. **상태 초기화**: 다른 이미지 선택 시 완전한 상태 리셋
4. **에러 복구**: 실패 후 다른 이미지 정상 로드

## 🔧 빌드 및 배포

### 개발 환경
```bash
# 의존성 설치
npm install  # 또는 pnpm install, yarn install

# 개발 서버 실행 (캐시 비활성화)
npm run dev

# 타입 검사
npm run type-check

# 린트 검사
npm run lint
```

### 프로덕션 배포
```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm run start

# 또는 정적 파일 배포
npm run export  # 정적 사이트 생성 시
```

### 환경 설정
- **개발**: 캐시 비활성화, 상세 로깅 활성화
- **프로덕션**: 캐시 활성화, 최적화된 로깅
- **HTTPS**: WebCrypto API 요구사항 (로컬은 localhost 허용)

## 🛠️ 완벽한 트러블슈팅 (해결됨)

### ✅ 해결된 주요 이슈들

### 1. 캐시 오염 문제 (완전 해결)
**이전 증상**: "19 bb 06 d0" 같은 잘못된 hex 값, "aeia"/"aeiw" 파싱 실패  
**해결 방법**: 
- 개발 모드 캐시 완전 비활성화
- 수동 캐시 클리어 버튼 추가
- Cache Storage 정책 환경별 분리

### 2. REF-A-2002 스펙 구현 (완전 준수)
**이전 증상**: 파일 구조 불일치로 인한 파싱 실패  
**해결 방법**:
- Format(4) + IV(12) + Ciphertext(가변) + Tag(16) + Tail 정확한 구현
- 가변 cipher 크기 지원 (1MB 미만 파일 처리)
- 상세한 hex dump 로깅으로 구조 검증

### 3. 상태 관리 문제 (완전 해결)
**이전 증상**: AEIA 파일 실패 후 다른 이미지도 작동 안 함  
**해결 방법**:
- AbortController로 요청 취소 구현
- 컴포넌트 완전 정리 (cleanup)
- 상태 초기화 강화

### 4. 이미지 렌더링 실패 (고급 fallback)
**이전 증상**: "복호화 성공!" 표시되지만 이미지 안 보임  
**해결 방법**:
- 4단계 fallback 시스템 구축
- RIFF 헤더 크기 정확한 계산
- Base64, Blob URL 등 다양한 렌더링 방식

### 5. 개발 효율성 (완전 자동화)
**개선사항**:
- 동적 파일 스캔 API (`/api/images`)
- 하드코딩 제거, 자동 메타데이터 추출
- 상세한 에러 로깅 및 디버깅 정보
- 완벽한 문서화 (TROUBLESHOOTING_GUIDE.md)

### 🎯 현재 상태: 모든 주요 이슈 해결 완료
- REF-A-2002 완전 준수 ✅
- 다단계 렌더링 시스템 ✅
- 지능형 캐시 관리 ✅
- 강화된 에러 처리 ✅

## 🔒 보안 주의사항 및 권장사항

⚠️ **현재 상태**: 이 PoC는 시연용으로 AES-256 키가 하드코딩되어 있습니다.

### 프로덕션 환경 보안 요구사항

#### 필수 구현사항
- 🔑 **KMS 연동**: AWS KMS, Azure Key Vault, Google Cloud KMS 활용
- 🎫 **JWT 기반 인증**: 토큰 기반 키 교환 시스템
- 🔄 **키 순환 정책**: 정기적 키 교체 (주/월 단위)
- 🛡️ **세션별 키 파생**: HKDF 또는 PBKDF2 활용
- 🚫 **클라이언트 키 노출 금지**: 서버 사이드 키 관리

#### 추가 보안 강화
- 🌐 **CSP 설정**: Content Security Policy 엄격 적용
- 🔒 **HTTPS 필수**: WebCrypto API 보안 요구사항
- 📊 **감사 로깅**: 키 사용 내역 추적
- 🎯 **권한 관리**: 이미지별 접근 권한 제어
- ⏰ **TTL 설정**: 복호화된 데이터 자동 만료

### 현재 구현의 보안 수준
- ✅ AES-GCM-256 (NIST 권장 알고리즘)
- ✅ WebCrypto API (브라우저 하드웨어 가속)
- ✅ 메모리 자동 정리 (ImageBitmap 해제)
- ✅ 요청 취소 (AbortController)
- ⚠️ 하드코딩된 키 (PoC 목적만)

## 🛠️ 기술 스택 및 아키텍처

### Core Technologies
- **Framework**: Next.js 15 (App Router) + TypeScript 5+
- **Styling**: Tailwind CSS 3+ (JIT 컴파일)
- **State Management**: React Hooks + AbortController
- **Build**: Turbopack (개발), Webpack (프로덕션)

### 암호화 및 보안
- **Crypto Engine**: Web Crypto API (AES-GCM-256)
- **Spec Compliance**: REF-A-2002 완전 준수
- **Key Management**: Hex-encoded 256-bit keys
- **Browser Support**: Chrome 37+, Firefox 34+, Safari 11+

### 이미지 처리
- **Primary**: createImageBitmap (하드웨어 가속)
- **Fallback**: Image 객체 + Base64 인코딩
- **Formats**: AVIF (고효율), WebP (호환성)
- **Canvas**: 2D Context + ImageBitmap 렌더링

### 캐싱 및 성능
- **Storage**: Cache Storage API (Service Worker 레벨)
- **Policy**: 환경별 캐시 정책 (dev/prod)
- **Optimization**: 메모리 자동 정리, 요청 취소

### 개발 도구
- **Linting**: ESLint + TypeScript
- **Type Checking**: Strict TypeScript 설정
- **Dev Server**: Fast Refresh + HMR
- **Debugging**: 상세 hex dump, 단계별 로깅

### API 및 통신
- **Dynamic Scanning**: Next.js API Routes
- **File System**: Node.js fs/promises
- **HTTP**: Fetch API + AbortController
- **Error Handling**: 구체적 에러 메시지, fallback 처리

## 📚 참고 문서

- 📖 **[구현 가이드](./md/IMPLEMENTATION_GUIDE.md)**: 단계별 구현 상세 설명
- 👨‍💻 **[인턴 개발자 가이드](./md/INTERN_GUIDE.md)**: 신규 개발자 온보딩
- 🔧 **[트러블슈팅 가이드](./TROUBLESHOOTING_GUIDE.md)**: 문제 해결 완벽 매뉴얼
- 📋 **[REF-A-2002 스펙](./claude/REF-A-2002.md)**: 암호화 파일 형식 명세

## 🤝 기여 및 개발

이 프로젝트는 REF-A-2002 스펙의 완전한 참조 구현을 목표로 합니다.

### 개발 워크플로우
1. **이슈 생성**: GitHub Issues에 버그 리포트 또는 기능 요청
2. **브랜치 생성**: `feature/`, `fix/`, `docs/` 접두사 사용
3. **구현**: TypeScript + 상세 주석 + 테스트
4. **문서 업데이트**: README, 가이드 문서 동시 업데이트
5. **PR 생성**: 코드 리뷰 후 메인 브랜치 병합

### 코딩 규칙
- **TypeScript Strict Mode** 준수
- **함수형 프로그래밍** 지향 (React Hooks)
- **상세한 에러 처리** 및 로깅
- **메모리 누수 방지** (정리 함수 구현)
- **브라우저 호환성** 고려 (폴리필 활용)

---

## 📞 문의 및 지원

**프로젝트 관련 문의**: GitHub Issues 활용  
**기술 지원**: [트러블슈팅 가이드](./TROUBLESHOOTING_GUIDE.md) 참조  
**보안 이슈**: 별도 연락 (실서비스 배포 전 필수 보안 검토)

---

💡 **이 프로젝트는 REF-A-2002 암호화 이미지 스펙의 완전한 구현체입니다.**  
🚀 **프로덕션 환경 배포 시 보안 가이드라인을 반드시 따라주세요.**