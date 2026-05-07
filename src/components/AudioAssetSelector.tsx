import React, { useState, useEffect } from "react";
import { listAudioAssets, type AudioAssetResponse } from "../lib/audioAssets";
import { useAudioAssetPlayer } from "../hooks/useAudioAssetPlayer";

interface AudioAssetSelectorProps {
  onAssetSelect?: (audioAsset: AudioAssetResponse) => void;
  selectedAssetId?: number;
  disabled?: boolean;
}

export function AudioAssetSelector({
  onAssetSelect,
  selectedAssetId,
  disabled = false,
}: AudioAssetSelectorProps) {
  const [audioAssets, setAudioAssets] = useState<AudioAssetResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    loadAudio,
    togglePlayPause,
    isPlaying,
    isLoading: isAudioLoading,
    error: audioError,
    currentTime,
    duration,
  } = useAudioAssetPlayer();

  // 音源リストを取得
  useEffect(() => {
    const loadAssets = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const assets = await listAudioAssets();
        setAudioAssets(assets);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load audio assets";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssets();
  }, []);

  // 音源を選択
  const handleAssetSelect = (asset: AudioAssetResponse) => {
    onAssetSelect?.(asset);
  };

  // 音源をプレビュー再生
  const handlePreviewPlay = async (asset: AudioAssetResponse) => {
    try {
      await loadAudio(asset);
      if (!isAudioLoading) {
        togglePlayPause();
      }
    } catch (err) {
      console.error("Failed to load audio for preview:", err);
    }
  };

  // 時間をフォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (error) {
    return (
      <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '8px', borderRadius: '4px' }}>
        エラー: {error}
      </div>
    );
  }

  if (audioAssets.length === 0) {
    return <div>音源がありません</div>;
  }

  return (
    <div className="audio-asset-selector">
      <div style={{ marginBottom: '12px', fontWeight: 'bold' }}>
        音源を選択
      </div>
      
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {audioAssets.map((asset) => (
          <div
            key={asset.id}
            style={{
              padding: '12px',
              border: selectedAssetId === asset.id ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '4px',
              marginBottom: '8px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              backgroundColor: selectedAssetId === asset.id ? '#f8f9fa' : 'white',
              opacity: disabled ? 0.6 : 1,
            }}
            onClick={() => !disabled && handleAssetSelect(asset)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  {asset.filename}
                </div>
                
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  {formatFileSize(asset.file_size)} • {asset.mime_type}
                </div>
                
                {asset.duration_sec && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    尺: {formatTime(asset.duration_sec)}
                  </div>
                )}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewPlay(asset);
                }}
                disabled={disabled || isAudioLoading}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: disabled || isAudioLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  marginLeft: '8px',
                }}
              >
                {isAudioLoading ? '読み込み中...' : isPlaying ? '停止' : '再生'}
              </button>
            </div>
            
            {audioError && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#721c24',
                backgroundColor: '#f8d7da',
                padding: '4px 8px',
                borderRadius: '4px',
              }}>
                再生エラー: {audioError}
              </div>
            )}
            
            {isPlaying && duration > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '4px',
                }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${(currentTime / duration) * 100}%`,
                    height: '100%',
                    backgroundColor: '#007bff',
                  }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ファイルサイズをフォーマット
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
