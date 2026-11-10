import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

import { Spinner } from '@/components/Spinner/Spinner.tsx';
import { bem } from '@/css/bem.ts';
import { extractAddressFromQrText } from '@/lib/qr.ts';
import { ru } from '@/i18n/ru.ts';

import './QrScannerModal.css';

const [b, e] = bem('qr-scanner-modal');

export interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (address: string) => void;
}

type ScannerState = 'requesting' | 'scanning' | 'denied';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream>();
  const frameRef = useRef<number>();
  const [state, setState] = useState<ScannerState>('requesting');
  const [retryToken, setRetryToken] = useState(0);
  // Read through a ref: the parent hands over a new function on every render, and that must not
  // restart the camera.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setState('requesting');

    void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        void video.play();
      }
      setState('scanning');

      function tick() {
        const canvas = canvasRef.current;
        const currentVideo = videoRef.current;
        if (canvas && currentVideo && currentVideo.readyState === currentVideo.HAVE_ENOUGH_DATA) {
          canvas.width = currentVideo.videoWidth;
          canvas.height = currentVideo.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              onScanRef.current(extractAddressFromQrText(code.data));
              return;
            }
          }
        }
        frameRef.current = requestAnimationFrame(tick);
      }
      frameRef.current = requestAnimationFrame(tick);
    }).catch(() => {
      if (!cancelled) {
        setState('denied');
      }
    });

    return () => {
      cancelled = true;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;
    };
  }, [open, retryToken]);

  if (!open) {
    return null;
  }

  return (
    <div className={b()}>
      <div className={e('top')}>
        <span className={e('title')}>{ru.withdraw.qrScannerTitle}</span>
        <button type="button" className={e('close')} onClick={onClose} aria-label={ru.header.close}>
          <CloseIcon/>
        </button>
      </div>

      {state !== 'denied' && (
        <div className={e('viewport')}>
          <video ref={videoRef} className={e('video')} playsInline muted/>
          <div className={e('frame', { scanning: state === 'scanning' })} aria-hidden="true">
            <span className={e('beam')}/>
          </div>
          {state === 'requesting' && <div className={e('waiting')}><Spinner size={28}/></div>}
        </div>
      )}

      {state === 'denied' && (
        <div className={e('denied')}>
          <p className={e('denied-text')}>{ru.withdraw.qrScannerPermissionDenied}</p>
          <button type="button" className={e('retry')} onClick={() => setRetryToken((n) => n + 1)}>
            {ru.withdraw.qrScannerRetryAction}
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className={e('canvas')}/>
    </div>
  );
}
