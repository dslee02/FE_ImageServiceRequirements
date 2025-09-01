import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    
    // public 디렉토리가 존재하는지 확인
    if (!fs.existsSync(publicDir)) {
      return NextResponse.json({ error: 'Public directory not found' }, { status: 404 });
    }

    // public 디렉토리의 모든 파일 읽기
    const files = fs.readdirSync(publicDir);
    
    // 이미지 파일만 필터링 (일반 이미지와 암호화된 이미지 포함)
    const imageExtensions = ['.webp', '.avif', '.jpg', '.jpeg', '.png', '.aeiw', '.aeia'];
    const imageFiles = files.filter(file => {
      const extension = path.extname(file.toLowerCase());
      return imageExtensions.includes(extension);
    });

    // 파일 정보와 함께 반환
    const fileInfos = imageFiles.map(filename => {
      const filePath = path.join(publicDir, filename);
      const stats = fs.statSync(filePath);
      const extension = path.extname(filename).toLowerCase();
      
      let isEncrypted = false;
      let originalExtension = extension.replace('.', '');
      
      // 암호화된 파일 확장자 처리
      if (extension === '.aeia') {
        isEncrypted = true;
        originalExtension = 'avif';
      } else if (extension === '.aeiw') {
        isEncrypted = true;
        originalExtension = 'webp';
      }

      return {
        name: filename,
        path: `/${filename}`,
        extension: extension.replace('.', ''),
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        modified: stats.mtime.toISOString(),
        isEncrypted,
        originalExtension
      };
    });

    // 파일 크기순으로 정렬 (작은 것부터)
    fileInfos.sort((a, b) => a.size - b.size);

    return NextResponse.json({
      success: true,
      count: fileInfos.length,
      files: fileInfos
    });

  } catch (error) {
    console.error('Error scanning images:', error);
    return NextResponse.json(
      { error: 'Failed to scan images' }, 
      { status: 500 }
    );
  }
}