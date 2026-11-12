import { useCallback, useEffect, useRef, useState } from 'react';
import type { Georreferencia } from './gps';

export type EstadoGps =
  | { estado: 'apagado' }
  | { estado: 'buscando' }
  | { estado: 'activo'; x: number; y: number; precision_m: number }
  | { estado: 'error'; mensaje: string };

function mensajeDeError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'No diste permiso para usar tu ubicación. Actívalo en la configuración del navegador o escanea un código QR.';
  }
  if (error.code === error.TIMEOUT) return 'El GPS tardó demasiado en responder. Intenta de nuevo al aire libre.';
  return 'No se pudo obtener tu ubicación. Revisa que la ubicación del celular esté encendida.';
}

/** Sigue la posición GPS del celular y la entrega convertida a coordenadas del plano. */
export function useUbicacionGps(geo: Georreferencia) {
  const [gps, setGps] = useState<EstadoGps>({ estado: 'apagado' });
  const vigilancia = useRef<number | null>(null);
  const tienePosicion = useRef(false);

  const soltar = () => {
    if (vigilancia.current != null) navigator.geolocation.clearWatch(vigilancia.current);
    vigilancia.current = null;
    tienePosicion.current = false;
  };

  const detener = useCallback(() => {
    soltar();
    setGps({ estado: 'apagado' });
  }, []);

  const iniciar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGps({ estado: 'error', mensaje: 'Este navegador no permite usar la ubicación.' });
      return;
    }
    if (vigilancia.current != null) return;
    setGps({ estado: 'buscando' });
    vigilancia.current = navigator.geolocation.watchPosition(
      (posicion) => {
        tienePosicion.current = true;
        const { x, y } = geo.aPlano(posicion.coords.latitude, posicion.coords.longitude);
        setGps({ estado: 'activo', x, y, precision_m: posicion.coords.accuracy });
      },
      (error) => {
        // Si la persona no se mueve, algunos celulares reportan TIMEOUT: se conserva la última posición.
        if (error.code === error.TIMEOUT && tienePosicion.current) return;
        soltar();
        setGps({ estado: 'error', mensaje: mensajeDeError(error) });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [geo]);

  useEffect(() => soltar, []);

  return { gps, iniciar, detener };
}
