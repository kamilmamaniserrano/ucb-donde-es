import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoGps =
  | { estado: 'apagado' }
  | { estado: 'buscando' }
  | { estado: 'activo'; lat: number; lng: number; precision_m: number }
  | { estado: 'error'; mensaje: string };

export interface Lectura {
  lat: number;
  lng: number;
  precision: number;
  t: number;
}

// Se promedian las lecturas de los últimos segundos: menos ruido y poco retraso al caminar (~2 m).
const VENTANA_MS = 4000;
// Lecturas con un error mayor se descartan en cuanto llega alguna mejor.
const PRECISION_MAXIMA_M = 40;

/** Promedio ponderado por precisión: una lectura de ±5 m pesa 4 veces más que una de ±10 m. */
export function promedioPonderado(lecturas: Lectura[]): { lat: number; lng: number } {
  let w = 0, lat = 0, lng = 0;
  for (const l of lecturas) {
    const peso = 1 / Math.max(1, l.precision) ** 2;
    w += peso;
    lat += l.lat * peso;
    lng += l.lng * peso;
  }
  return { lat: lat / w, lng: lng / w };
}

function mensajeDeError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'No diste permiso para usar tu ubicación. Actívalo en la configuración del navegador o escanea un código QR.';
  }
  if (error.code === error.TIMEOUT) return 'El GPS tardó demasiado en responder. Intenta de nuevo al aire libre.';
  return 'No se pudo obtener tu ubicación. Revisa que la ubicación del celular esté encendida.';
}

/** Sigue la posición GPS del celular, filtrada y suavizada. */
export function useUbicacionGps() {
  const [gps, setGps] = useState<EstadoGps>({ estado: 'apagado' });
  const vigilancia = useRef<number | null>(null);
  const lecturas = useRef<Lectura[]>([]);
  const hayBuena = useRef(false);

  const soltar = () => {
    if (vigilancia.current != null) navigator.geolocation.clearWatch(vigilancia.current);
    vigilancia.current = null;
    lecturas.current = [];
    hayBuena.current = false;
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
        const nueva: Lectura = {
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
          precision: posicion.coords.accuracy,
          t: posicion.timestamp || Date.now(),
        };
        const buena = nueva.precision <= PRECISION_MAXIMA_M;
        if (!buena && hayBuena.current) return;
        // Las primeras lecturas suelen venir de antenas o wifi (±50–100 m): se descartan al llegar el GPS.
        if (buena && !hayBuena.current) lecturas.current = [];
        hayBuena.current ||= buena;
        lecturas.current = [...lecturas.current.filter((l) => nueva.t - l.t <= VENTANA_MS), nueva];
        setGps({ estado: 'activo', ...promedioPonderado(lecturas.current), precision_m: nueva.precision });
      },
      (error) => {
        // Si la persona no se mueve, algunos celulares reportan TIMEOUT: se conserva la última posición.
        if (error.code === error.TIMEOUT && lecturas.current.length) return;
        soltar();
        setGps({ estado: 'error', mensaje: mensajeDeError(error) });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  useEffect(() => soltar, []);

  return { gps, iniciar, detener };
}
