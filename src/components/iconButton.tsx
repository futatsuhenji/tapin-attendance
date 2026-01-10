export function IconButton({
    active,
    disabled,
    onClick,
    label,
    children,
}: {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    label: string;
    children: React.ReactNode;
}) {
    const base =
        'inline-flex h-9 w-9 items-center justify-center rounded-md border ' +
        'transition-colors select-none';
    const state = active
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
    const dis = disabled ? 'opacity-50 pointer-events-none' : '';

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={`${base} ${state} ${dis}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
