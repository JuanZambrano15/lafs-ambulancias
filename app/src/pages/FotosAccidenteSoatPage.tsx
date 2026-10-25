
/**
 * Fotos del accidente SOAT, adjuntadas después del cierre (issue
 * #18) -- a diferencia del resto del formato, esto solo se puede
 * hacer con la atención ya cerrada (requisito explícito del
 * cliente), y solo el auxiliar/médico que atendió (o un
 * administrador, que no usa esta app) puede subir o borrar fotos --
 * ver `_puede_gestionar_fotos_soat` en el backend. Esta pantalla no
 * intenta replicar ese chequeo, solo muestra el error del backend si
 * llega a darse (p. ej. dos auxiliares comparten el mismo teléfono).
 *
 * Las fotos van siempre al final del PDF (otro requisito explícito
 * del cliente, ver `app/pdf/formato_accidente_soat.py`); esta
 * pantalla no influye en eso, el orden de llegada acá es el orden en
 * el PDF.
 *
 * Issue #18 (QA): a diferencia del resto de los formularios de esta
 * app, subir/borrar una foto no se encola para cuando vuelva la
 * conexión (ver `lib/trasladoOffline.ts`) -- encolar un archivo
 * binario es una categoría de problema distinta (espacio en disco del
 * dispositivo, reintentos de un `multipart/form-data` completo) que
 * no se decidió resolver en este issue. Si el auxiliar está sin
 * señal, esta pantalla simplemente no funciona todavía; puede volver
 * más tarde, la atención sigue cerrada y disponible en "Mis
 * atenciones cerradas".
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
import logoLafs from '../assets/logo-lafs.png'
 
interface FotoConVistaPrevia {
  foto: FormatoAccidenteSoatFoto
  /** `null` mientras se descarga la miniatura -- la lista ya se puede
   * ver y borrar antes de que todas las vistas previas terminen de
   * cargar. */
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
        // Las miniaturas se traen aparte y de una vez: cada foto ya
        // puede ser varios MB, no tiene sentido bloquear la lista
        // completa esperando a que todas bajen.
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
              // Una miniatura que falla no debe tumbar toda la pantalla
              // -- esa foto se queda sin vista previa, nada más.
            })
        })
      })
      .catch((err) => {
        if (cancelado) return
        setErrorCarga(
          err instanceof ApiError ? err.message : 'No se pudieron cargar las fotos',
        )
      })
 
    return () => {
      cancelado = true
    }
  }, [atencionId])
 
  // Las URLs de las vistas previas (`URL.createObjectURL`) viven en
  // memoria del navegador hasta que se liberan explícitamente -- sin
  // esto, entrar y salir de esta pantalla varias veces va acumulando
  // memoria sin soltarla nunca.
  useEffect(() => {
    return () => {
      fotos?.forEach((item) => {
        if (item.urlVistaPrevia) URL.revokeObjectURL(item.urlVistaPrevia)
      })
    }
    // Solo al desmontar la pantalla, no en cada actualización de `fotos`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
 
  async function manejarSeleccionArchivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0]
    // El input se limpia ya mismo -- si no, seleccionar el mismo
    // archivo dos veces seguidas no dispara `onChange` la segunda vez.
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
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-sm sm:max-w-2xl lg:max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
          ← Volver
        </button>
 
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="mb-3 h-10 w-auto" />
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Fotos del accidente</h1>
          <p className="mb-6 text-sm text-slate-500">
            Quedan al final del PDF del formato, en el orden en que se suben. Solo quien atendió
            esta atención puede agregarlas o borrarlas.
          </p>
 
          {errorCarga ? (
            <p role="alert" className="text-sm text-brand-orange-dark">
              {errorCarga}
            </p>
          ) : fotos === null ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : (
            <>
              {fotos.length === 0 && (
                <p className="mb-4 text-sm text-slate-500">Todavía no hay fotos adjuntas.</p>
              )}
 
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {fotos.map(({ foto, urlVistaPrevia }) => (
                  <li key={foto.id} className="relative overflow-hidden rounded-lg border border-slate-200">
                    {urlVistaPrevia ? (
                      <img
                        src={urlVistaPrevia}
                        alt={`Foto subida el ${foto.subida_en}`}
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                        Cargando…
                      </div>
                    )}
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
 
              {error && (
                <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
                  {error}
                </p>
              )}
 
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(evento) => void manejarSeleccionArchivo(evento)}
              />
              <button
                type="button"
                onClick={() => inputArchivoRef.current?.click()}
                disabled={subiendo}
                className="w-full rounded-lg bg-brand-blue py-3 text-base font-medium text-white disabled:opacity-60"
              >
                {subiendo ? 'Subiendo…' : '+ Agregar foto'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}