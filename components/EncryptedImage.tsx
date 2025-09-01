"use client";

import { useEffect, useRef, useState } from "react";
import { parseAe } from "@/lib/crypto/parse";
import { decryptHeadAESGCM } from "@/lib/crypto/decrypt";
import { renderToCanvas } from "@/lib/image/render";
import { getEncryptedImage, putEncryptedImage } from "@/lib/cache/store";

interface EncryptedImageProps {
  contentId: string;
  baseUrl: string;
  aesKey: string;
  className?: string;
  alt?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
  useCache?: boolean;
}

export default function EncryptedImage({
  contentId,
  baseUrl,
  aesKey,
  className = "",
  alt = "",
  onLoad,
  onError,
  useCache = true,
}: EncryptedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    let abortController = new AbortController();
    let processingRef = { current: false };

    const loadImage = async () => {
      if (!canvasRef.current) return;
      
      // 이전 처리 중인 작업이 있다면 취소하고 새로 시작
      if (processingRef.current) {
        console.log('🔄 이전 작업 취소 후 새 작업 시작');
        abortController.abort();
        abortController = new AbortController();
      }
      
      processingRef.current = true;

      try {
        setLoading(true);
        setError("");

        // Demo: 암호화 이미지가 없는 경우 플레이스홀더 표시
        if (contentId === "sample" || contentId === "placeholder") {
          // Canvas에 플레이스홀더 텍스트 렌더링
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = 500;
              canvas.height = 350;

              // 배경
              ctx.fillStyle = "#f9fafd";
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              // 테두리
              ctx.strokeStyle = "#e5e7eb";
              ctx.lineWidth = 2;
              ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

              // 제목
              ctx.fillStyle = "#1f2937";
              ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(
                "🔒 AES-GCM-256 암호화 이미지",
                canvas.width / 2,
                canvas.height / 2 - 50
              );

              // 설명
              ctx.fillStyle = "#6b7280";
              ctx.font = "14px system-ui, -apple-system, sans-serif";
              ctx.fillText(
                "Canvas API + 복호화 렌더링 시뮬레이션",
                canvas.width / 2,
                canvas.height / 2 - 10
              );
              ctx.fillText(
                "(데모용 - 실제 암호화 파일 없음)",
                canvas.width / 2,
                canvas.height / 2 + 15
              );

              // 안내문
              ctx.fillStyle = "#059669";
              ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
              ctx.fillText(
                '💡 실제 암호화된 파일을 보려면 "encrypted-demo.aeiw"를 선택하세요',
                canvas.width / 2,
                canvas.height / 2 + 45
              );
            }
          }

          if (mounted) {
            setLoading(false);
            onLoad?.();
          }
          return;
        }

        // contentId가 실제 암호화 파일인지 확인 (간단한 체크)
        let imageUrl: string;
        if (contentId.includes("aeia") || contentId.includes("aeiw")) {
          // 이미 .aeia/.aeiw 확장자가 포함된 경우 그대로 사용
          imageUrl = contentId.startsWith("/") ? contentId : `/${contentId}`;
        } else {
          // contentId가 파일명만 있는 경우 확장자 추가
          const hasExtension = contentId.includes(".");
          if (hasExtension) {
            imageUrl = contentId.startsWith("/") ? contentId : `/${contentId}`;
          } else {
            // 확장자가 없으면 .aeiw 추가 (기본값)
            imageUrl = `/${contentId}.aeiw`;
          }
        }

        console.log(`🔍 암호화 이미지 로드 시도:`, {
          contentId,
          baseUrl,
          imageUrl,
          useCache,
        });

        let blob: Blob | null = null;

        // 캐시에서 먼저 시도 (개발 모드에서는 캐시 무력화)
        const isDev = process.env.NODE_ENV === 'development';
        if (useCache && !isDev) {
          blob = await getEncryptedImage(imageUrl);
          if (blob) {
            console.log('📦 캐시에서 이미지 로드:', imageUrl);
          }
        } else if (isDev) {
          console.log('🔄 개발 모드: 캐시 무시하고 새로 로드');
        }

        // 캐시에 없으면 네트워크에서 가져오기
        if (!blob) {
          const response = await fetch(imageUrl, {
            signal: abortController.signal
          });

          if (!response.ok) {
            throw new Error(
              `암호화된 이미지 로드 실패: ${response.status} ${response.statusText}`
            );
          }

          blob = await response.blob();

          // 캐시에 저장 (개발 모드에서는 저장하지 않음)
          if (useCache && !isDev) {
            await putEncryptedImage(imageUrl, blob);
            console.log('💾 캐시에 이미지 저장:', imageUrl);
          } else if (isDev) {
            console.log('🚫 개발 모드: 캐시에 저장하지 않음');
          }
        }

        if (!mounted) return;

        // 암호화된 이미지 처리
        await processEncryptedImage(blob);

        if (mounted) {
          setLoading(false);
          onLoad?.();

          // 복호화 성공 메시지 추가
          if (contentId.includes("encrypted-demo")) {
            console.log("🎉 암호화된 데모 이미지 복호화 완료!");
            console.log(
              "📊 브라우저 개발자 도구에서 복호화 과정을 확인할 수 있습니다."
            );
          }
        }
      } catch (err) {
        if (mounted && !abortController.signal.aborted) {
          const errorMessage = err instanceof Error && err.name === 'AbortError' 
            ? "요청이 취소되었습니다"
            : err instanceof Error
              ? err.message
              : "암호화된 이미지 로드 중 오류가 발생했습니다.";
          
          console.warn('❌ EncryptedImage 로드 실패:', errorMessage);
          setError(errorMessage);
          setLoading(false);
          
          // AbortError가 아닌 경우만 상위로 에러 전파
          if (!(err instanceof Error && err.name === 'AbortError')) {
            onError?.(errorMessage);
          }
        }
      } finally {
        processingRef.current = false;
      }
    };

    const processEncryptedImage = async (blob: Blob) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Blob을 ArrayBuffer로 변환
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // 파일 파싱 (파일명 전달)
      const parsed = parseAe(bytes, contentId);

      // 헤드 부분 복호화 (1MB)
      const decryptedHead = await decryptHeadAESGCM(
        aesKey,
        parsed.iv,
        parsed.cipher,
        parsed.tag
      );

      // 복호화된 헤드 + tail 재조립
      const fullImage = new Uint8Array(
        decryptedHead.length + parsed.tail.length
      );
      fullImage.set(decryptedHead, 0);
      fullImage.set(parsed.tail, decryptedHead.length);

      // Canvas에 렌더링 (개선된 방식)
      await renderToCanvas(canvas, fullImage, parsed.format);
    };

    // 약간의 디바운싱과 초기 상태 설정
    setLoading(true);
    setError("");
    const timeoutId = setTimeout(loadImage, 100);

    return () => {
      mounted = false;
      abortController.abort();
      clearTimeout(timeoutId);
      processingRef.current = false;
      console.log('🧹 EncryptedImage 클린업 완료');
    };
  }, [contentId, baseUrl, aesKey, useCache, onLoad, onError]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 text-gray-500 ${className}`}
      >
        <span className="text-sm">{error}</span>
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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: loading ? "none" : "block",
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: "8px",
        }}
        aria-label={alt}
      />
    </div>
  );
}
