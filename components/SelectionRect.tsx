export default function SelectionRect({ rect }: { rect: DOMRect }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: rect.y,
        left: rect.x,
        width: rect.width,
        height: rect.height,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        border: '2px solid #00BFFF',
        pointerEvents: 'none',
      }}
    />
  );
}
