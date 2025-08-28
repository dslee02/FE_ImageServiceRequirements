/**
 * Cache Storage API를 사용한 암호화된 이미지 파일 캐싱 유틸리티
 * 암호화된 원본 바이너리를 그대로 저장/조회
 */

const CACHE_NAME = "img-encrypted-v1";

export class EncryptedImageCache {
  private cache: Cache | null = null;

  private async getCache(): Promise<Cache | null> {
    if (typeof window === 'undefined' || !('caches' in window)) {
      return null;
    }
    
    if (!this.cache) {
      this.cache = await caches.open(CACHE_NAME);
    }
    return this.cache;
  }

  async put(url: string, blob: Blob): Promise<void> {
    try {
      const cache = await this.getCache();
      if (!cache) {
        console.warn("캐시를 사용할 수 없습니다. 서버 환경이거나 브라우저가 Cache API를 지원하지 않습니다.");
        return;
      }
      
      const response = new Response(blob, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "max-age=86400" // 24시간
        }
      });
      
      await cache.put(url, response);
      console.log(`암호화된 이미지 캐시 저장 완료: ${url}`);
    } catch (error) {
      console.error("캐시 저장 실패:", error);
      // 캐시 저장 실패해도 에러를 던지지 않음 (선택사항이므로)
    }
  }

  async get(url: string): Promise<Blob | null> {
    try {
      const cache = await this.getCache();
      if (!cache) {
        return null;
      }
      
      const response = await cache.match(url);
      
      if (!response) {
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error("캐시 조회 실패:", error);
      return null;
    }
  }

  async delete(url: string): Promise<boolean> {
    try {
      const cache = await this.getCache();
      if (!cache) {
        return false;
      }
      return await cache.delete(url);
    } catch (error) {
      console.error("캐시 삭제 실패:", error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !('caches' in window)) {
        return;
      }
      
      await caches.delete(CACHE_NAME);
      this.cache = null;
      console.log("캐시 전체 삭제 완료");
    } catch (error) {
      console.error("캐시 전체 삭제 실패:", error);
    }
  }

  async keys(): Promise<string[]> {
    try {
      const cache = await this.getCache();
      if (!cache) {
        return [];
      }
      const requests = await cache.keys();
      return requests.map(req => req.url);
    } catch (error) {
      console.error("캐시 키 목록 조회 실패:", error);
      return [];
    }
  }
}

// 싱글톤 인스턴스
export const encryptedImageCache = new EncryptedImageCache();

// 편의 함수들
export async function putEncryptedImage(url: string, blob: Blob): Promise<void> {
  return encryptedImageCache.put(url, blob);
}

export async function getEncryptedImage(url: string): Promise<Blob | null> {
  return encryptedImageCache.get(url);
}

export async function deleteEncryptedImage(url: string): Promise<boolean> {
  return encryptedImageCache.delete(url);
}

export async function clearEncryptedImageCache(): Promise<void> {
  return encryptedImageCache.clear();
}