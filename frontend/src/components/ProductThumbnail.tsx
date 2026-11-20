
import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ProductThumbnailProps {
  src: string
  alt: string
  className?: string
}

export default function ProductThumbnail({
  src,
  alt,
  className = '',
}: ProductThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const imageAvailable =
    src.trim().length > 0 && failedSrc !== src

  return (
    <div
      className={`relative overflow-hidden bg-accent ${className}`}
    >
      {imageAvailable ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
          role="img"
          aria-label={`${alt} preview unavailable`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-outline bg-surface">
            <ImageOff
              className="h-6 w-6 text-brand"
              aria-hidden="true"
            />
          </div>

          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Preview unavailable
          </span>
        </div>
      )}
    </div>
  )
}
