const encoder = new TextEncoder()

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function header(size, fields) {
  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)
  fields.forEach(([offset, value, width]) => view[`setUint${width}`](offset, value, true))
  return bytes
}

export function createZipBlob(files) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content
    const checksum = crc32(data)
    const local = header(30, [
      [0, 0x04034b50, 32], [4, 20, 16], [6, 0x0800, 16], [8, 0, 16],
      [10, 0, 16], [12, 0x21, 16], [14, checksum, 32], [18, data.length, 32],
      [22, data.length, 32], [26, name.length, 16], [28, 0, 16],
    ])
    const central = header(46, [
      [0, 0x02014b50, 32], [4, 20, 16], [6, 20, 16], [8, 0x0800, 16],
      [10, 0, 16], [12, 0, 16], [14, 0x21, 16], [16, checksum, 32],
      [20, data.length, 32], [24, data.length, 32], [28, name.length, 16],
      [30, 0, 16], [32, 0, 16], [34, 0, 16], [36, 0, 16], [38, 0, 32], [42, offset, 32],
    ])
    localParts.push(local, name, data)
    centralParts.push(central, name)
    offset += local.length + name.length + data.length
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
  const end = header(22, [
    [0, 0x06054b50, 32], [4, 0, 16], [6, 0, 16], [8, files.length, 16],
    [10, files.length, 16], [12, centralSize, 32], [16, offset, 32], [20, 0, 16],
  ])
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' })
}