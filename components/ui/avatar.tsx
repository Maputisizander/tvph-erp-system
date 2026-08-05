import Image from "next/image";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, className = "size-8" }: AvatarProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? "Avatar"}
        width={32}
        height={32}
        className={`rounded-full object-cover ${className}`}
        unoptimized
      />
    );
  }

  const initials = (name ?? "?")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm ${className}`}
    >
      {initials}
    </span>
  );
}
