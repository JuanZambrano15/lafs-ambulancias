/**
 * Convierte la foto (o el archivo) de una firma en un data URL listo
 * para guardarse junto al formato.
 *
 * Una foto de la cámara de la tablet puede pesar varios MB, y el
 * backend rechaza las firmas de más de 300.000 caracteres (ver
 * `firma_*` en `app/schemas/formato_traslado.py` del API). Por eso la
 * imagen se reduce y se recomprime como JPEG antes de guardarla,
 * probando lados cada vez más pequeños hasta que quepa con margen.
 */

/** Margen bajo el límite de 300.000 caracteres que acepta el backend. */
const MAX_CARACTERES = 250_000

/** Lado mayor (px) a probar, de más a menos calidad. */
const LADOS_A_PROBAR = [1000, 800, 600, 400]

const CALIDAD_JPEG = 0.8

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()
    imagen.onload = () => {
      URL.revokeObjectURL(url)
      resolve(imagen)
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    imagen.src = url
  })
}

export async function archivoADataUrlFirma(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo elegido no es una imagen.')
  }
  const imagen = await cargarImagen(archivo)
  const ladoMayor = Math.max(imagen.naturalWidth, imagen.naturalHeight)
  if (ladoMayor === 0) throw new Error('No se pudo leer la imagen.')

  for (const lado of LADOS_A_PROBAR) {
    const escala = Math.min(1, lado / ladoMayor)
    const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala))
    const alto = Math.max(1, Math.round(imagen.naturalHeight * escala))
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('No se pudo procesar la imagen.')
    // JPEG no tiene transparencia: sin este fondo, un PNG transparente
    // quedaría negro.
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, ancho, alto)
    contexto.drawImage(imagen, 0, 0, ancho, alto)
    const resultado = canvas.toDataURL('image/jpeg', CALIDAD_JPEG)
    if (resultado.length <= MAX_CARACTERES) return resultado
  }
  throw new Error('La imagen es demasiado grande para usarla como firma.')
}