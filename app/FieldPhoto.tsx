export default function FieldPhoto({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  if (src) return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  return (<div role="img" aria-label={alt} className={`relative overflow-hidden bg-pitch ${className}`}>
    <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/25" />
    <div className="absolute left-1/2 top-1/2 aspect-square h-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" /></div>);
}
