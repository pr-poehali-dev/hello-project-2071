// Генерирует PNG-иконку в виде data URL из SVG
export function generateIconDataUrl(size: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#1e3a5f"/>
    <text x="${size / 2}" y="${size * 0.62}" 
      font-family="Arial Black, Arial, sans-serif" 
      font-size="${size * 0.3}" 
      font-weight="900" 
      fill="white" 
      text-anchor="middle">КМ</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
