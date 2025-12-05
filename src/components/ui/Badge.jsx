const Badge = ({ children, color = 'gray' }) => {
  const styles = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700'
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[color] || styles.gray}`}>{children}</span>;
};

export default Badge;