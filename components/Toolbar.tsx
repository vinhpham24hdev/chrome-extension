export default function Toolbar({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-[2147483648]">
      <button
        className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow"
        onClick={onConfirm}
      >
        Sử dụng vùng chọn
      </button>
      <button
        className="px-4 py-2 rounded-lg bg-gray-500/80 text-white font-medium shadow"
        onClick={onCancel}
      >
        Hủy
      </button>
    </div>
  );
}
