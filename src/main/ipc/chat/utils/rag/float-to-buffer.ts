function float32ToBuffer(vec: number[]): Buffer {
  const arr = Float32Array.from(vec);
  return Buffer.from(arr.buffer);
}

export { float32ToBuffer };