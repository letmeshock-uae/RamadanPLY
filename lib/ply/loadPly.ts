/**
 * PLY loading pipeline — fetch, detect format, parse, detect 3DGS.
 */
import { detect3dgs, DetectResult } from './detect3dgs';
import { parsePlyAscii, PlyProperty } from './parsePlyAscii';
import { parsePlyBinary } from './parsePlyBinary';

export interface PlyData {
  vertexCount: number;
  properties: PlyProperty[];
  arrays: Record<string, Float32Array>;
  is3dgs: boolean;
  detection: DetectResult;
}

interface ParsedHeader {
  format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
  vertexCount: number;
  properties: PlyProperty[];
  headerByteLength: number;
}

function parseHeader(text: string): ParsedHeader {
  const lines = text.split('\n');
  let format: ParsedHeader['format'] = 'ascii';
  let vertexCount = 0;
  const properties: PlyProperty[] = [];
  let inVertex = false;
  let headerEnd = 0;
  let byteOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    byteOffset += lines[i].length + 1; // +1 for \n

    if (line.startsWith('format ')) {
      const parts = line.split(' ');
      if (parts[1] === 'binary_little_endian') format = 'binary_little_endian';
      else if (parts[1] === 'binary_big_endian') format = 'binary_big_endian';
      else format = 'ascii';
    } else if (line.startsWith('element vertex')) {
      vertexCount = parseInt(line.split(' ')[2], 10);
      inVertex = true;
    } else if (line.startsWith('element ') && !line.startsWith('element vertex')) {
      inVertex = false;
    } else if (line.startsWith('property ') && inVertex) {
      const parts = line.split(' ');
      if (parts[1] !== 'list') {
        properties.push({ type: parts[1], name: parts[2] });
      }
    } else if (line === 'end_header') {
      headerEnd = byteOffset;
      break;
    }
  }

  return { format, vertexCount, properties, headerByteLength: headerEnd };
}

export async function loadPly(url: string): Promise<PlyData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PLY: ${response.status}`);

  const buffer = await response.arrayBuffer();

  // Read header as text (first 4KB is usually enough)
  const headerSlice = new Uint8Array(buffer, 0, Math.min(4096, buffer.byteLength));
  const headerText = new TextDecoder().decode(headerSlice);

  if (!headerText.startsWith('ply')) {
    throw new Error('Not a valid PLY file');
  }

  const header = parseHeader(headerText);
  const propNames = header.properties.map((p) => p.name);
  const detection = detect3dgs(propNames);

  let arrays: Record<string, Float32Array>;

  if (header.format === 'ascii') {
    const fullText = new TextDecoder().decode(new Uint8Array(buffer));
    const headerEndIndex = fullText.indexOf('end_header\n') + 'end_header\n'.length;
    arrays = parsePlyAscii(fullText, headerEndIndex, header.properties, header.vertexCount);
  } else {
    arrays = parsePlyBinary(buffer, header.headerByteLength, header.properties, header.vertexCount);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[PLY] format=${header.format} vertices=${header.vertexCount} 3dgs=${detection.is3dgs} — ${detection.reason}`
    );
  }

  return {
    vertexCount: header.vertexCount,
    properties: header.properties,
    arrays,
    is3dgs: detection.is3dgs,
    detection,
  };
}
