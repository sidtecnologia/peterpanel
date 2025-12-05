import Card from './Card';
import { X } from 'lucide-react';

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <Card className="w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4 border-b pb-2 sticky top-0 bg-white z-10">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <button onClick={onClose}><X className="text-slate-400 hover:text-slate-700" /></button>
      </div>
      {children}
    </Card>
  </div>
);

export default Modal;