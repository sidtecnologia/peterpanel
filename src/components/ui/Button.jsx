const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon, type = 'button' }) => {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
  };
  return (
    <button type={type} onClick={onClick} className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${styles[variant]} ${className}`} disabled={disabled}>
      {Icon && <Icon size={18} />} {children}
    </button>
  );
};

export default Button;