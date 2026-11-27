// Leitor de QR Code pela câmera traseira. Usa o BarcodeDetector do
// navegador quando existe (Chrome/Android) e a biblioteca "jsqr" como
// alternativa (iPhone/Safari), carregada só quando precisa.
// Exige HTTPS (ou localhost) e permissão de câmera.
import { useEffect, useRef, useState } from 'react'
import styles from './QrScanner.module.css'

export function QrScanner({ onResult, paused = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const onResultRef = useRef(onResult)
  const pausedRef = useRef(paused)
  const [error, setError] = useState('')

  useEffect(() => {
    onResultRef.current = onResult
    pausedRef.current = paused
  })

  useEffect(() => {
    let stream
    let frame
    let stopped = false
    let lastValue = ''
    let lastAt = 0

    const emit = (value) => {
      const now = Date.now()
      // evita disparar várias vezes seguidas para o mesmo código
      if (!value || pausedRef.current || (value === lastValue && now - lastAt < 3000)) return
      lastValue = value
      lastAt = now
      onResultRef.current?.(value)
    }

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (stopped) return
        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        let detect
        if ('BarcodeDetector' in window) {
          const formats = await window.BarcodeDetector.getSupportedFormats?.()
          if (!formats || formats.includes('qr_code')) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
            detect = async () => (await detector.detect(video))[0]?.rawValue
          }
        }
        if (!detect) {
          const jsQR = (await import('jsqr')).default
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          detect = async () => {
            const w = video.videoWidth
            const h = video.videoHeight
            if (!w || !h) return null
            const scale = Math.min(1, 640 / Math.max(w, h))
            canvas.width = Math.round(w * scale)
            canvas.height = Math.round(h * scale)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data
          }
        }

        const tick = async () => {
          if (stopped) return
          try {
            if (video.readyState >= 2) emit(await detect())
          } catch {
            /* quadro ruim: tenta o próximo */
          }
          frame = setTimeout(tick, 250)
        }
        tick()
      } catch (e) {
        if (stopped) return
        if (e?.name === 'NotAllowedError') setError('Permita o uso da câmera para ler o QR Code (ícone de cadeado na barra de endereço).')
        else if (e?.message === 'unsupported') setError('Este navegador não permite usar a câmera. Busque pelo número do pedido.')
        else setError('Não foi possível abrir a câmera. Busque pelo número do pedido.')
      }
    })()

    return () => {
      stopped = true
      clearTimeout(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className={styles.scanner}>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <>
          <video ref={videoRef} className={styles.video} muted playsInline aria-label="Câmera para ler o QR Code" />
          <span className={styles.frame} aria-hidden="true" />
        </>
      )}
      <canvas ref={canvasRef} hidden />
    </div>
  )
}
