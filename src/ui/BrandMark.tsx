export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`corelum-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <path
        className="mark-outer"
        d="M46 10H26C14.95 10 6 18.95 6 30v4c0 11.05 8.95 20 20 20h20V42H27a10 10 0 0 1 0-20h19V10Z"
        fill="currentColor"
      />
      <path className="mark-core" d="M46 25h12v14H46z" fill="currentColor" />
    </svg>
  );
}
