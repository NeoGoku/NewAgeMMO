import { open } from 'node:fs/promises';
import { PROPERTY_CATALOG_MAX_BYTES } from './geo-property-data';

export async function readPropertyCatalog(filename?: string): Promise<unknown> {
  if (!filename) return;
  const file = await open(filename, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > PROPERTY_CATALOG_MAX_BYTES) throw new Error('OSM-Immobilienkatalog überschreitet 4 MiB oder ist keine Datei');
    const data = Buffer.alloc(info.size + 1);
    const { bytesRead } = await file.read(data);
    if (bytesRead !== info.size) throw new Error('OSM-Immobilienkatalog wurde gleichzeitig geändert');
    return JSON.parse(data.subarray(0, bytesRead).toString('utf8'));
  } finally {
    await file.close();
  }
}
