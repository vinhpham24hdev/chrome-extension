export default async function cropImage(png: string, rect: DOMRect): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const ratio = window.devicePixelRatio;
      const canvas = document.createElement('canvas');
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        img,
        rect.x * ratio,
        rect.y * ratio,
        rect.width * ratio,
        rect.height * ratio,
        0,
        0,
        rect.width * ratio,
        rect.height * ratio
      );
      res(canvas.toDataURL('image/png'));
    };
    img.src = png;
  });
}
