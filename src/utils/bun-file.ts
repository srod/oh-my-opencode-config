export async function stat(path: string | URL) {
  return Bun.file(path).stat()
}
