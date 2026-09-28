// Base64 for the stored CV PDF: chrome.storage keeps JSON, not bytes.

const chunkSize = 0x8000

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize))
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}
