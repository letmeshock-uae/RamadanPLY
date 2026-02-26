/**
 * Parse binary-little-endian PLY body.
 */
export interface PlyProperty {
  name: string;
  type: string;
}

const TYPE_SIZES: Record<string, number> = {
  char: 1, uchar: 1, short: 2, ushort: 2,
  int: 4, uint: 4, float: 4, double: 8,
  int8: 1, uint8: 1, int16: 2, uint16: 2,
  int32: 4, uint32: 4, float32: 4, float64: 8,
};

export function parsePlyBinary(
  buffer: ArrayBuffer,
  headerByteLength: number,
  properties: PlyProperty[],
  vertexCount: number
): Record<string, Float32Array> {
  const arrays: Record<string, Float32Array> = {};
  for (const prop of properties) {
    arrays[prop.name] = new Float32Array(vertexCount);
  }

  // Compute stride
  let stride = 0;
  const offsets: number[] = [];
  for (const prop of properties) {
    offsets.push(stride);
    stride += TYPE_SIZES[prop.type] ?? 4;
  }

  const view = new DataView(buffer, headerByteLength);

  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    for (let j = 0; j < properties.length; j++) {
      const offset = base + offsets[j];
      const type = properties[j].type;
      let value = 0;

      if (offset + (TYPE_SIZES[type] ?? 4) > view.byteLength) break;

      switch (type) {
        case 'float': case 'float32':
          value = view.getFloat32(offset, true); break;
        case 'double': case 'float64':
          value = view.getFloat64(offset, true); break;
        case 'uchar': case 'uint8':
          value = view.getUint8(offset); break;
        case 'char': case 'int8':
          value = view.getInt8(offset); break;
        case 'ushort': case 'uint16':
          value = view.getUint16(offset, true); break;
        case 'short': case 'int16':
          value = view.getInt16(offset, true); break;
        case 'uint': case 'uint32':
          value = view.getUint32(offset, true); break;
        case 'int': case 'int32':
          value = view.getInt32(offset, true); break;
        default:
          value = view.getFloat32(offset, true);
      }
      arrays[properties[j].name][i] = value;
    }
  }

  return arrays;
}
