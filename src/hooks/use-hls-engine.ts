import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface UseHlsEngineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamUrl: string | null;
  fallbackUrl?: string;
}

export function useHlsEngine({ videoRef, streamUrl, fallbackUrl }: UseHlsEngineProps) {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        enableWorker: true,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Erro de rede detetado, a tentar recuperar...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Erro de média/decodificação, a tentar recuperar...");
              hls.recoverMediaError();
              break;
            default:
              if (fallbackUrl && streamUrl !== fallbackUrl) {
                console.log("A alternar para o stream de fallback...");
                hls.loadSource(fallbackUrl);
              } else {
                hls.destroy();
              }
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    }
  }, [streamUrl, fallbackUrl, videoRef]);
}
