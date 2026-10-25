
/**
 * Fotos del accidente SOAT, adjuntadas después del cierre (issue
 * #18) -- vista del panel web. A diferencia de `app/`, que solo deja
 * subir/borrar al auxiliar/médico que atendió, el administrador
 * puede subir y borrar desde acá también (decisión explícita del
 * cliente para este issue, ver `_puede_gestionar_fotos_soat` en el
 * backend); esta pantalla no intenta replicar ese chequeo, solo
 * muestra el error del backend si llega a darse.
 *
 * Las fotos van siempre al final del PDF (otro requisito explícito
 * del cliente, ver `app/pdf/formato_accidente_soat.py`); esta
 * pantalla no influye en eso, el orden de llegada acá es el orden en
 * el PDF.
 *
 * Se llega acá desde la fila de una atención SOAT cerrada en
 * `PendientesPage` ("Fotos"), no desde el menú lateral -- no es una
 * sección en sí, es un detalle de una atención puntual.
 */
 
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
 
import {
  ApiError,
  descargarFotoAccidenteSoat,
  eliminarFotoAccidenteSoat,
  listarFotosAccidenteSoat,
  subirFotoAccidenteSoat,
} from '../lib/api'
import type { FormatoAccidenteSoatFoto } from '../lib/types'
 
interface FotoConVistaPrevia {
  foto: FormatoAccidenteSoatFoto
  /** `null` mientras se descarga la miniatura. */
  urlVistaPrevia: string | null
}
 
export function FotosAccidenteSoatPage(): JSX.Element {
  const { atencionId } = useParams<{ atencionId: string }>()
  const navigate = useNavigate()
  const inputArchivoRef = useRef<HTMLInputElement>(null)
 
  const [fotos, setFotos] = useState<FotoConVistaPrevia[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrandoId, setBorrandoId] = useState<number | null>(null)
 
  useEffect(() => {
    if (!atencionId) return
    let cancelado = false
 
    listarFotosAccidenteSoat(Number(atencionId))
      .then((lista) => {
        if (cancelado) return
        setFotos(lista.map((foto) => ({ foto, urlVistaPrevia: null })))
        lista.forEach((foto) => {
          descargarFotoAccidenteSoat(Number(atencionId), foto.id)
            .then((blob) => {
              if (cancelado) return
              const url = URL.createObjectURL(blob)
              setFotos((actuales) =>
                (actuales ?? []).map((item) =>
                  item.foto.id === foto.id ? { ...item, urlVistaPrevia: url } : item,
                ),
              )
            })
            .catch(() => {
              // Una miniatura que falla no debe tumbar toda la pantalla.
            })
        })
      })
      .catch((err: unknown) => {
        if (cancelado) return
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudieron cargar las fotos')
      })
 
    return () => {
      cancelado = true
    }
  }, [atencionId])
 
  useEffect(() => {
    return () => {
      fotos?.forEach((item) => {
        if (item.urlVistaPrevia) URL.revokeObjectURL(item.urlVistaPrevia)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
 
  async function manejarSeleccionArchivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo || !atencionId) return
 
    setError(null)
    setSubiendo(true)
    try {
      const foto = await subirFotoAccidenteSoat(Number(atencionId), archivo, archivo.name)
      const url = URL.createObjectURL(archivo)
      setFotos((actuales) => [...(actuales ?? []), { foto, urlVistaPrevia: url }])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto')
    } finally {
      setSubiendo(false)
    }
  }
 
  async function manejarBorrar(foto: FormatoAccidenteSoatFoto): Promise<void> {
    if (!atencionId) return
    if (!window.confirm('¿Borrar esta foto? No se puede deshacer.')) return
 
    setError(null)
    setBorrandoId(foto.id)
    try {
      await eliminarFotoAccidenteSoat(Number(atencionId), foto.id)
      setFotos((actuales) => {
        const quitada = actuales?.find((item) => item.foto.id === foto.id)
        if (quitada?.urlVistaPrevia) URL.revokeObjectURL(quitada.urlVistaPrevia)
        return (actuales ?? []).filter((item) => item.foto.id !== foto.id)
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo borrar la foto')
    } finally {
      setBorrandoId(null)
    }
  }
 
  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← Volver
      </button>
 
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Fotos del accidente</h2>
        <input
          ref={inputArchivoRef}
          type="file"
          // Issue #18 (corregido tras QA): "image/*" en vez de una
          // lista fija -- el backend decide qué formato se acepta de
          // verdad decodificando el archivo (ver
          // `_detectar_formato_foto`), no este atributo.
          accept="image/*"
          className="hidden"
          onChange={(evento) => void manejarSeleccionArchivo(evento)}
        />
        <button
          type="button"
          onClick={() => inputArchivoRef.current?.click()}
          disabled={subiendo}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {subiendo ? 'Subiendo…' : '+ Agregar foto'}
        </button>
      </div>
 
      <p className="mb-4 text-sm text-slate-500">
        Quedan al final del PDF del formato, en el orden en que se suben.
      </p>
 
      {errorCarga && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {errorCarga}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
 
      {fotos === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : fotos.length === 0 ? (
        <p className="text-slate-500">Todavía no hay fotos adjuntas.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {fotos.map(({ foto, urlVistaPrevia }) => (
            <li key={foto.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              {urlVistaPrevia ? (
                <a href={urlVistaPrevia} target="_blank" rel="noreferrer">
                  <img
                    src={urlVistaPrevia}
                    alt={`Foto subida por ${foto.subida_por.documento} el ${foto.subida_en}`}
                    className="h-32 w-full object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-32 w-full items-center justify-center text-xs text-slate-400">
                  Cargando…
                </div>
              )}
              <p className="px-2 py-1 text-xs text-slate-500">{foto.subida_en}</p>
              <button
                type="button"
                onClick={() => void manejarBorrar(foto)}
                disabled={borrandoId === foto.id}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {borrandoId === foto.id ? '…' : 'Borrar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}