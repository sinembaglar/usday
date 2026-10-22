import { useEffect, useRef, useState } from 'react'

const MAX_ZOOM = 4
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// Drag to move, pinch or slider to zoom; returns a JPEG data URL of the framed area.
export default function ImageCropper({ src, aspect, onCancel, onDone }) {
  const frameRef = useRef(null)
  const imgRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef(null)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const el = frameRef.current
    const measure = () => setFrame({ w: el.clientWidth, h: el.clientWidth / aspect })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [aspect])

  const baseScale = natural ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1
  const scale = baseScale * zoom
  const shown = natural ? { w: natural.w * scale, h: natural.h * scale } : { w: 0, h: 0 }

  const limit = (o, s = scale) => {
    const maxX = Math.max(0, (natural.w * s - frame.w) / 2)
    const maxY = Math.max(0, (natural.h * s - frame.h) / 2)
    return { x: clamp(o.x, -maxX, maxX), y: clamp(o.y, -maxY, maxY) }
  }

  function changeZoom(next) {
    const z = clamp(next, 1, MAX_ZOOM)
    setZoom(z)
    setOffset((o) => limit(o, baseScale * z))
  }

  function startGesture() {
    const pts = [...pointers.current.values()]
    gesture.current = {
      pts,
      offset,
      zoom,
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
    }
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    const g = gesture.current
    if (pts.length === 2 && g.dist) {
      changeZoom((g.zoom * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / g.dist)
    } else if (pts.length === 1) {
      setOffset(limit({ x: g.offset.x + pts[0].x - g.pts[0].x, y: g.offset.y + pts[0].y - g.pts[0].y }))
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    startGesture()
  }

  function done() {
    const outW = 1400
    const outH = Math.round(outW / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const left = (shown.w - frame.w) / 2 - offset.x
    const top = (shown.h - frame.h) / 2 - offset.y
    canvas
      .getContext('2d')
      .drawImage(imgRef.current, left / scale, top / scale, frame.w / scale, frame.h / scale, 0, 0, outW, outH)
    onDone(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="cropper">
      <h3>Fotoğrafı ayarla</h3>
      <p className="hint">Sürükleyerek kaydır, iki parmakla ya da çubukla yakınlaştır.</p>

      <div
        ref={frameRef}
        className="crop-frame"
        style={{ height: frame.h || undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => changeZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92))}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{
            width: shown.w || undefined,
            height: shown.h || undefined,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            visibility: natural ? 'visible' : 'hidden',
          }}
        />
      </div>

      <input
        className="zoom"
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(e) => changeZoom(Number(e.target.value))}
        aria-label="Yakınlaştır"
      />

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button className="btn btn-primary" onClick={done} disabled={!natural}>
          Kullan
        </button>
      </div>
    </div>
  )
}
