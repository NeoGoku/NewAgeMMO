import { PROPERTY_CATALOG_MAX_BYTES } from './geo-property-data';

export async function readPropertyCatalogResponse(response: Response, maxBytes = PROPERTY_CATALOG_MAX_BYTES): Promise<unknown> {
  if (!response.ok || !response.body) throw new Error(`OSM-Immobilienkatalog konnte nicht gelesen werden (HTTP ${response.status})`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let data = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return JSON.parse(data + decoder.decode());
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error('OSM-Immobilienkatalog überschreitet die erlaubte Größe');
    }
    data += decoder.decode(value, { stream: true });
  }
}
