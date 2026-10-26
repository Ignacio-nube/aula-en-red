import { networkInterfaces } from 'node:os';
import { Router } from 'express';
import QRCode from 'qrcode';
import type { InfoServidor } from '@aula/shared';
import { PUERTO } from '../config';
import { getConfig } from '../db';

export const info = Router();

/** IPv4 de la red local, las más probables primero (192.168.x, 10.x, 172.16–31.x). */
export function ipsLocales(): string[] {
  const ips: string[] = [];
  for (const lista of Object.values(networkInterfaces())) {
    for (const ni of lista ?? []) {
      if (ni.family === 'IPv4' && !ni.internal && !ni.address.startsWith('169.254.')) ips.push(ni.address);
    }
  }
  const prioridad = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return ips.sort((a, b) => prioridad(a) - prioridad(b));
}

export function urlsLocales(): string[] {
  return ipsLocales().map((ip) => `http://${ip}:${PUERTO}`);
}

const cacheQr = new Map<string, string>();

info.get('/info', async (_req, res) => {
  const urls = urlsLocales();
  const url = urls[0] ?? `http://localhost:${PUERTO}`;
  let qr = cacheQr.get(url);
  if (!qr) {
    qr = await QRCode.toDataURL(url, {
      margin: 1,
      width: 480,
      color: { dark: '#3C3C3B', light: '#FFFFFF' },
    });
    cacheQr.set(url, qr);
  }
  const respuesta: InfoServidor = { ...getConfig(), url, urls, qr };
  res.json(respuesta);
});

// Errores de pantalla de los navegadores (ver client/src/components/pd/Fallo.tsx): se muestran en
// la consola del server, que es lo único que el profe tiene a mano para contarnos qué pasó.
let ultimosErrores: number[] = [];
info.post('/errores', (req, res) => {
  const ahora = Date.now();
  ultimosErrores = ultimosErrores.filter((t) => ahora - t < 60_000);
  if (ultimosErrores.length < 20) {
    ultimosErrores.push(ahora);
    const { vista, mensaje, detalle } = (req.body ?? {}) as Record<string, unknown>;
    const corto = (v: unknown, n: number) => String(v ?? '').slice(0, n);
    console.error(`\n⚠️  Falló la pantalla de ${corto(vista, 20)}: ${corto(mensaje, 300)}\n${corto(detalle, 1500)}\n`);
  }
  res.status(204).end();
});
