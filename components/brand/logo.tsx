import { kanit } from "@/lib/fonts";

// โลโก้ Quibby — ตัว Q ในกรอบไล่เฉดม่วง-ชมพู + ประกาย (ตรงกับ app/icon.svg)
export function LogoMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="quibby-logo"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#quibby-logo)" />
      <circle cx="15" cy="15.5" r="6.3" fill="none" stroke="#fff" strokeWidth="3" />
      <line
        x1="17.4"
        y1="17.9"
        x2="22"
        y2="22.5"
        stroke="#fff"
        strokeWidth="3.3"
        strokeLinecap="round"
      />
      <path
        d="M23 8l.72 1.86L25.6 10.6l-1.88.74L23 13.2l-.72-1.86L20.4 10.6l1.88-.74z"
        fill="#fff"
        opacity="0.95"
      />
    </svg>
  );
}

export function Logo({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className={`${kanit.className} text-xl font-bold`}>Quibby</span>
    </span>
  );
}
