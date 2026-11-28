import type { DownloadedFile } from '../types/order'

export function saveDownloadedFile(
  file: DownloadedFile,
): void {
  const objectUrl = URL.createObjectURL(file.blob)

  const link = document.createElement('a')

  try {
    link.href = objectUrl
    link.download = file.filename

    document.body.appendChild(link)

    link.click()
  } finally {
    link.remove()

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 1000)
  }
}