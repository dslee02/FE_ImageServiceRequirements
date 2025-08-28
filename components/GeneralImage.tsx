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
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        // 이미지 URL 생성
        const imageUrl = contentId.startsWith("/") || contentId.startsWith("http") 
          ? contentId 
          : `${baseUrl}${contentId}`;

        // 이미 같은 URL을 로드 중이면 건너뛰기
        if (imageSrc && imageSrc.includes(imageUrl)) {
          return;
        }

        setLoading(true);
        setError("");

        let blob: Blob | null = null;

        // 캐시에서 먼저 시도
        if (useCache) {
          blob = await getEncryptedImage(imageUrl);
        }

        // 캐시에 없으면 네트워크에서 가져오기
        if (!blob) {
          const response = await fetch(imageUrl);

          if (!response.ok) {
            throw new Error(
              `이미지 로드 실패: ${response.status} ${response.statusText}`
            );
          }

          blob = await response.blob();

          // 캐시에 저장
          if (useCache && blob) {
            await putEncryptedImage(imageUrl, blob);
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
        if (mounted) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "이미지 로드 중 오류가 발생했습니다.";
          setError(errorMessage);
          setLoading(false);
          onError?.(errorMessage);
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

    checkAvif();
    loadImage();

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
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
