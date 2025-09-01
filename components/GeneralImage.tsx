"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getEncryptedImage, putEncryptedImage } from "@/lib/cache/store";
import {
  getImageMeta,
  generateImageUrl,
  getOptimalWidth,
  supportsAvif,
} from "@/lib/image/metadata";

interface GeneralImageProps {
  contentId: string;
  baseUrl: string;
  className?: string;
  alt?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
  useCache?: boolean;
  width?: number;
  height?: number;
}

export default function GeneralImage({
  contentId,
  baseUrl,
  className = "",
  alt = "",
  onLoad,
  onError,
  useCache = true,
  width,
  height,
}: GeneralImageProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [avifSupported, setAvifSupported] = useState(false);

  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        // 이미지 URL 생성
        const imageUrl = contentId.startsWith("/") || contentId.startsWith("http") 
          ? contentId 
          : `${baseUrl}${contentId}`;

        console.log('🖼️ GeneralImage 로드 시작:', imageUrl);

        setLoading(true);
        setError("");

        let blob: Blob | null = null;

        // 캐시에서 먼저 시도 (개발 모드에서는 캐시 무력화)
        const isDev = process.env.NODE_ENV === 'development';
        if (useCache && !isDev) {
          blob = await getEncryptedImage(imageUrl);
          if (blob) {
            console.log('📦 GeneralImage 캐시에서 로드:', imageUrl);
          }
        } else if (isDev) {
          console.log('🔄 GeneralImage 개발 모드: 캐시 무시');
        }

        // 캐시에 없으면 네트워크에서 가져오기
        if (!blob) {
          const response = await fetch(imageUrl, {
            signal: abortController.signal
          });

          if (!response.ok) {
            throw new Error(
              `이미지 로드 실패: ${response.status} ${response.statusText}`
            );
          }

          blob = await response.blob();

          // 캐시에 저장 (개발 모드에서는 저장하지 않음)
          if (useCache && blob && !isDev) {
            await putEncryptedImage(imageUrl, blob);
            console.log('💾 GeneralImage 캐시에 저장:', imageUrl);
          } else if (isDev) {
            console.log('🚫 GeneralImage 개발 모드: 캐시 저장 생략');
          }
        }

        if (!mounted || !blob) return;

        // 기존 Object URL 정리
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        // Object URL 생성
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        if (mounted && !abortController.signal.aborted) {
          const errorMessage = err instanceof Error && err.name === 'AbortError'
            ? "요청이 취소되었습니다"
            : err instanceof Error
              ? err.message
              : "이미지 로드 중 오류가 발생했습니다.";
          
          console.warn('❌ GeneralImage 로드 실패:', errorMessage);
          setError(errorMessage);
          setLoading(false);
          
          // AbortError가 아닌 경우만 상위로 에러 전파
          if (!(err instanceof Error && err.name === 'AbortError')) {
            onError?.(errorMessage);
          }
        }
      }
    };

    // AVIF 지원 여부 확인 (한 번만)
    const checkAvif = async () => {
      if (avifSupported === false) return;
      const supported = await supportsAvif();
      if (mounted) {
        setAvifSupported(supported);
      }
    };

    // 초기 상태 설정
    setLoading(true);
    setError("");
    setImageSrc("");
    
    checkAvif();
    loadImage();

    return () => {
      mounted = false;
      abortController.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      console.log('🧹 GeneralImage 클린업 완료');
    };
  }, [contentId, baseUrl, useCache, onError]);

  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    const errorMessage = "이미지를 표시할 수 없습니다.";
    setError(errorMessage);
    setLoading(false);
    onError?.(errorMessage);
  };

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 text-gray-500 ${className}`}
      >
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (loading || !imageSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: "100%", height: "100%" }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        width={width ?? 500}
        height={height ?? 500}
        unoptimized
        onLoad={handleLoad}
        onError={handleError}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: "8px",
        }}
      />
    </div>
  );
}
