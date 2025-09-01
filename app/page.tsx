"use client";

import { useState, useEffect, useCallback } from "react";
import EncryptedImage from "@/components/EncryptedImage";
import GeneralImage from "@/components/GeneralImage";
import { supportsAvif } from "@/lib/image/metadata";

// PoC용 하드코딩된 AES-256 키들 (실서비스에서는 절대 금지)
const DEMO_KEYS: { [key: string]: string } = {
  "encrypted-file_example_WEBP_50kB.aeiw":
    "8ee17769082089b4e23f7c6afe8dec72b1a2c297853e43e0c01ace85b6b1d1ca",
  "encrypted-file_example_WEBP_1500kB.aeiw":
    "f9d64d37e25c86bbdeb349c80336c77ccff56a76f00da8ceb4473acc6c023bda",
};

// 기본 키 (fallback)
const DEFAULT_KEY_HEX =
  "8ee17769082089b4e23f7c6afe8dec72b1a2c297853e43e0c01ace85b6b1d1ca";

type ImageType = "encrypted" | "general";
type LoadingState = "idle" | "loading" | "success" | "error";

interface ImageInfo {
  name: string;
  path: string;
  extension: string;
  isEncrypted: boolean;
  originalExtension?: string;
}

interface ImageMetadata {
  fileName: string;
  originalExtension: string;
  isEncrypted: boolean;
  encryptionStatus: string;
  decryptionStatus: string;
  fileSize?: number;
  processingMethod: string;
  cacheUsed: boolean;
  loadTime?: number;
}

export default function Home() {
  const [imageType, setImageType] = useState<ImageType>("encrypted");
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [avifSupported, setAvifSupported] = useState<boolean | null>(null);
  const [publicImages, setPublicImages] = useState<ImageInfo[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("sample");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(
    null
  );
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

  const getKeyForFile = (filename: string): string => {
    return DEMO_KEYS[filename] || DEFAULT_KEY_HEX;
  };

  const checkAvifSupport = async () => {
    console.log("=== AVIF 지원 테스트 시작 ===");
    console.log("브라우저 정보:", {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
    });

    const startTime = Date.now();
    const supported = await supportsAvif();
    const endTime = Date.now();

    console.log(`=== AVIF 지원 테스트 완료 (${endTime - startTime}ms) ===`);
    console.log("결과:", supported ? "✅ 지원됨" : "❌ 지원되지 않음");

    setAvifSupported(supported);
  };

  const detectImageType = useCallback((filename: string): ImageInfo => {
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    let isEncrypted = false;
    let originalExtension = extension;

    // 암호화된 파일 확장자만 암호화로 처리
    if (extension === "aeia") {
      isEncrypted = true;
      originalExtension = "avif";
    } else if (extension === "aeiw") {
      isEncrypted = true;
      originalExtension = "webp";
    }
    // 일반 avif, webp, jpeg 등은 비암호화로 처리

    return {
      name: filename,
      path: `/${filename}`,
      extension,
      isEncrypted,
      originalExtension,
    };
  }, []);

  useEffect(() => {
    // public 폴더의 이미지 목록 (실제 존재하는 파일만)
    const imageFiles = [
      "file_example_WEBP_50kB.webp",
      "file_example_WEBP_1500kB.webp",
      "encrypted-file_example_WEBP_50kB.aeiw",
      "encrypted-file_example_WEBP_1500kB.aeiw",
    ];

    const images = imageFiles.map(detectImageType);
    console.log("Setting public images:", images);
    setPublicImages(images);
  }, [detectImageType]);

  const handleImageSelect = (imageName: string) => {
    const baseContentId = imageName.split(".")[0];

    // 이미 선택된 이미지인 경우 아무것도 하지 않음
    if (selectedImage === imageName && !customUrl) return;

    // 모든 파일에 대해 전체 파일명 사용
    const contentId = imageName;

    setSelectedImage(contentId);
    setCustomUrl("");
    setShowUrlInput(false);
    setLoadingState("idle");
    setErrorMessage("");

    const imageInfo = publicImages.find((img) => img.name === imageName);
    if (imageInfo) {
      setImageType(imageInfo.isEncrypted ? "encrypted" : "general");
      updateImageMetadata(imageInfo);
    }
  };

  const handleUrlLoad = () => {
    if (!customUrl.trim()) return;

    const filename = customUrl.split("/").pop() || "";
    const imageInfo = detectImageType(filename);

    setSelectedImage(customUrl);
    setImageType(imageInfo.isEncrypted ? "encrypted" : "general");
    setLoadingState("idle");
    setErrorMessage("");
    updateImageMetadata(imageInfo, customUrl);
  };

  const updateImageMetadata = (imageInfo: ImageInfo, url?: string) => {
    const metadata: ImageMetadata = {
      fileName: imageInfo.name,
      originalExtension: imageInfo.originalExtension || imageInfo.extension,
      isEncrypted: imageInfo.isEncrypted,
      encryptionStatus: imageInfo.isEncrypted
        ? "AES-GCM-256 암호화됨"
        : "비암호화",
      decryptionStatus: imageInfo.isEncrypted
        ? "복호화 대기 중"
        : "복호화 불필요",
      processingMethod: imageInfo.isEncrypted
        ? "Canvas API + AES-GCM-256"
        : "Next.js Image 컴포넌트",
      cacheUsed: false,
      loadTime: 0,
    };

    if (url) {
      metadata.fileName = url;
    }

    setImageMetadata(metadata);
  };

  const handleImageLoad = () => {
    // 이미 성공 상태인 경우 중복 처리 방지
    if (loadingState === "success") return;

    setLoadingState("success");
    setErrorMessage("");
    if (imageMetadata) {
      setImageMetadata({
        ...imageMetadata,
        decryptionStatus: imageMetadata.isEncrypted
          ? "AES-GCM-256 복호화 완료"
          : "복호화 불필요",
        cacheUsed: true,
        loadTime: Date.now() - (imageMetadata.loadTime || Date.now()),
      });
    }
  };

  const handleImageError = (error: string) => {
    setLoadingState("error");
    setErrorMessage(error);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          이미지 서비스 PoC
        </h1>

        {/* Public 이미지 목록 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Public 이미지 목록
          </h2>
          {publicImages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              이미지 목록을 로딩 중...
            </div>
          ) : (
            <div className="space-y-1 mb-4">
              {publicImages.map((image) => (
                <div
                  key={image.name}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 ${
                    selectedImage === image.name
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-sm text-gray-500 flex-1">
                      {image.isEncrypted
                        ? "🔒 AES-GCM-256 암호화"
                        : "일반 이미지"}
                      <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">
                        {image.extension.toUpperCase()}
                      </span>
                      {image.isEncrypted && (
                        <span className="ml-2 text-xs text-amber-600">
                          · 복호화 후 식별 가능
                        </span>
                      )}
                    </span>
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        image.isEncrypted ? "bg-red-500" : "bg-green-500"
                      }`}
                    ></div>
                    <button
                      onClick={() => handleImageSelect(image.name)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                        selectedImage === image.name
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700"
                      }`}
                    >
                      {selectedImage === image.name ? "선택됨" : "로드"}
                    </button>
                    <button
                      onClick={() => handleImageSelect(image.name)}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left flex-shrink-0"
                    >
                      {image.name}
                    </button>
                  </div>
                  <br />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* URL 입력 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            이미지 URL 입력
          </h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="이미지 URL을 입력하세요 (예: https://example.com/image.aeia 또는 sample.jpeg)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleUrlLoad}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              로드
            </button>
          </div>
        </div>
        <br />

        {/* 이미지 표시 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex gap-2">
              <button
                onClick={checkAvifSupport}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                style={{ marginRight: "16px" }}
              >
                AVIF 지원 확인
              </button>

              <button
                onClick={() => setImageType("encrypted")}
                className={`px-4 py-2 rounded-md transition-colors ${
                  imageType === "encrypted"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                암호화된 이미지
              </button>
              <button
                onClick={() => setImageType("general")}
                className={`px-4 py-2 rounded-md transition-colors ${
                  imageType === "general"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                일반 이미지
              </button>
            </div>
          </div>
          <br />

          {avifSupported !== null && (
            <div
              className={`mb-4 p-3 rounded-md ${
                avifSupported
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              <strong>AVIF 지원:</strong>{" "}
              {avifSupported ? "지원됨" : "미지원 (WebP 사용)"}
            </div>
          )}

          {loadingState === "error" && errorMessage && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <strong>오류:</strong> {errorMessage}
            </div>
          )}

          {loadingState === "success" && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              <strong>로드 완료:</strong>{" "}
              {imageType === "encrypted" ? "암호화된 이미지" : "일반 이미지"}{" "}
              렌더링 성공
            </div>
          )}

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
            style={{ width: "500px", height: "500px", margin: "0 auto" }}
          >
            {imageType === "encrypted" ? (
              <EncryptedImage
                contentId={customUrl || selectedImage}
                baseUrl={customUrl ? "" : "/"}
                aesKey={getKeyForFile(customUrl || selectedImage)}
                className="w-full h-full"
                alt="암호화된 이미지"
                onLoad={handleImageLoad}
                onError={handleImageError}
                useCache={true}
              />
            ) : (
              <GeneralImage
                contentId={customUrl || selectedImage}
                baseUrl={customUrl ? "" : "/"}
                className="w-full h-full"
                alt="일반 이미지"
                onLoad={handleImageLoad}
                onError={handleImageError}
                useCache={false}
              />
            )}
          </div>
        </div>

        {/* 이미지 메타데이터 */}
        {imageMetadata && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              이미지 처리 정보
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">파일명:</span>
                <span className="ml-2 text-gray-600">
                  {imageMetadata.fileName}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">원본 확장자:</span>
                <span className="ml-2 text-gray-600">
                  {imageMetadata.originalExtension.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">암호화 방식:</span>
                <span
                  className={`ml-2 ${
                    imageMetadata.isEncrypted
                      ? "text-red-600 font-medium"
                      : "text-green-600"
                  }`}
                >
                  {imageMetadata.encryptionStatus}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">복호화 상태:</span>
                <span
                  className={`ml-2 ${
                    imageMetadata.decryptionStatus.includes("완료")
                      ? "text-green-600 font-medium"
                      : imageMetadata.decryptionStatus.includes("대기")
                      ? "text-orange-600"
                      : "text-blue-600"
                  }`}
                >
                  {imageMetadata.decryptionStatus}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">처리 방식:</span>
                <span className="ml-2 text-gray-600">
                  {imageMetadata.processingMethod}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">캐시 사용:</span>
                <span
                  className={`ml-2 ${
                    imageMetadata.cacheUsed ? "text-green-600" : "text-gray-500"
                  }`}
                >
                  {imageMetadata.cacheUsed ? "CacheStorage 활용" : "초기 로드"}
                </span>
              </div>
            </div>

            {/* 기술 세부사항 */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                기술 구현 세부사항
              </h3>
              <div className="text-xs text-gray-600 space-y-1">
                {imageMetadata.isEncrypted ? (
                  <>
                    <p>• AES-GCM-256 알고리즘으로 파일 앞 1MB 암호화</p>
                    <p>• Canvas API를 통한 복호화 후 렌더링</p>
                    <p>• AVIF 우선, WebP fallback 지원</p>
                    <p>• CacheStorage에 암호화된 원본 저장</p>
                  </>
                ) : (
                  <>
                    <p>• Next.js Image 컴포넌트 최적화 활용</p>
                    <p>• 브라우저 네이티브 이미지 렌더링</p>
                    <p>• 자동 해상도 최적화 (128배수 프리셋)</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <hr className="my-8 border-gray-300" />

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            기능 설명
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">
                암호화된 이미지
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                <li>AES-GCM-256으로 암호화된 컨텐츠 이미지</li>
                <li>파일 앞 1MB만 암호화, 나머지는 평문</li>
                <li>Canvas API를 사용하여 복호화 후 렌더링</li>
                <li>Cache Storage에 암호화된 원본 저장</li>
                <li>AVIF 실패 시 WebP로 자동 fallback</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">
                일반 이미지
              </h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 text-sm">
                <li>암호화되지 않은 일반 이미지</li>
                <li>AVIF/WebP 포맷 지원</li>
                <li>Next.js Image 컴포넌트 사용</li>
                <li>Cache Storage에 이미지 바이너리 저장</li>
                <li>최적 해상도 자동 선택 (128배수 프리셋)</li>
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-3 text-gray-700">
              브라우저 지원
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="text-gray-700">AVIF 지원:</strong>
                <ul className="list-disc list-inside ml-4 text-gray-600">
                  <li>Chrome 85+ (2020년 이후)</li>
                  <li>Firefox 93+ (2021년 이후)</li>
                  <li>Safari 16+ (2022년 이후)</li>
                </ul>
              </div>
              <div>
                <strong className="text-gray-700">WebP 지원:</strong>
                <ul className="list-disc list-inside ml-4 text-gray-600">
                  <li>Chrome 23+ (2012년 이후)</li>
                  <li>Firefox 65+ (2019년 이후)</li>
                  <li>Safari 14+ (2020년 이후)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-md">
            <strong>주의:</strong> 이 데모는 AES 키가 하드코딩되어 있습니다.
            실제 서비스에서는 보안 키 관리 시스템을 사용해야 합니다.
          </div>
        </div>
      </div>
    </div>
  );
}
