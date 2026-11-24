export function compressImageData(dataUrl: string, maxDim = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onerror = () => reject(new Error('decode_failed'))
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no_canvas')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

export function compressPhotoFile(file: File, maxDim = 900, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read_failed'))
    reader.onload = () => compressImageData(reader.result as string, maxDim, quality).then(resolve, reject)
    reader.readAsDataURL(file)
  })
}
