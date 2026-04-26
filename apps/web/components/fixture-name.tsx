import Image from "next/image";

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={name}
      width={16}
      height={16}
      className="size-4 shrink-0 object-contain"
    />
  );
}

export function FixtureName({
  fixture,
  homeLogo,
  awayLogo,
  className = "text-sm font-semibold text-foreground",
  logoPosition = "start",
}: {
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  className?: string;
  logoPosition?: "start" | "end";
}) {
  const [home, away] = fixture.split(" vs ");
  if (!home || !away) {
    return <p className={className}>{fixture}</p>;
  }
  return (
    <p className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {logoPosition === "start" && <TeamLogo src={homeLogo} name={home} />}
      <span>{home}</span>
      {logoPosition === "end" && <TeamLogo src={homeLogo} name={home} />}
      <span className="font-normal text-muted-foreground">vs</span>
      {logoPosition === "start" && <TeamLogo src={awayLogo} name={away} />}
      <span>{away}</span>
      {logoPosition === "end" && <TeamLogo src={awayLogo} name={away} />}
    </p>
  );
}
