import React, { useRef } from "react";
import { useAudioAssetUpload } from "../hooks/useAudioAssetUpload";
import type { AudioAssetResponse } from "../types/audioAssets";

interface AudioAssetUploaderProps {
  onUploadSuccess?: (audioAsset: AudioAssetResponse) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export function AudioAssetUploader({
  onUploadSuccess,
  onUploadError,
  disabled = false,
}: AudioAssetUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadAudio, isUploading, error, progress } = useAudioAssetUpload();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 音源ファイルのみ許可
    if (!file.type.startsWith('audio/')) {
      onUploadError?.('音源ファイルを選択してください');
      return;
    }

    // ファイルサイズチェック（50MB制限）
    if (file.size > 50 * 1024 * 1024) {
      onUploadError?.('ファイルサイズは50MB以下にしてください');
      return;
    }

    const result = await uploadAudio(file);
    
    if (result) {
      onUploadSuccess?.(result);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else if (error) {
      onUploadError?.(error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="audio-asset-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />
      
      <button
        onClick={handleUploadClick}
        disabled={disabled || isUploading}
        style={{
          padding: '8px 16px',
          backgroundColor: isUploading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          fontSize: '14px',
        }}
      >
        {isUploading ? 'アップロード中...' : '音源をアップロード'}
      </button>

      {isUploading && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            width: '200px',
            height: '4px',
            backgroundColor: '#f0f0f0',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {progress}% 完了
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          エラー: {error}
        </div>
      )}
    </div>
  );
}
