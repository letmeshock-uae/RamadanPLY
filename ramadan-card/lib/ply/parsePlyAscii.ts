/**
 * Parse ASCII-format PLY body given header info.
 */
export interface PlyProperty {
  name: string;
  type: string;
}

export function parsePlyAscii(
  text: string,
  headerEndIndex: number,
  properties: PlyProperty[],
  vertexCount: number
): Record<string, Float32Array> {
  const body = text.slice(headerEndIndex);
  const lines = body.split('\n').filter((l) => l.trim() !== '');

  const arrays: Record<string, Float32Array> = {};
  for (const prop of properties) {
    arrays[prop.name] = new Float32Array(vertexCount);
  }

  for (let i = 0; i < Math.min(vertexCount, lines.length); i++) {
    const values = lines[i].trim().split(/\s+/);
    for (let j = 0; j < properties.length; j++) {
      arrays[properties[j].name][i] = parseFloat(values[j] ?? '0');
    }
  }

  return arrays;
}
