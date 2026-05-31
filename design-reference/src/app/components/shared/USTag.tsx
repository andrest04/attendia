interface USTagProps {
  ids: string[];
  className?: string;
}

export function USTag({ ids, className = '' }: USTagProps) {
  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${className}`}>
      {ids.map((id) => (
        <span
          key={id}
          style={{
            fontSize: '9px',
            color: '#9E9E9E',
            border: '1px solid #E0E0E0',
            padding: '1px 4px',
            borderRadius: '2px',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          [{id}]
        </span>
      ))}
    </div>
  );
}
