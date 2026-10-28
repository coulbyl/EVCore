type UserAvatarProps = {
  avatarUrl: string | null | undefined;
  username: string;
  size?: number;
  className?: string;
};

// Teintes 700 : les initiales blanches y passent 4,5:1. Les teintes 500
// d'avant descendaient à 2,2:1 (ambre) et 2,8:1 (orange).
const AVATAR_COLORS = [
  "#1d4ed8",
  "#4338ca",
  "#6d28d9",
  "#0369a1",
  "#047857",
  "#b45309",
  "#b91c1c",
  "#c2410c",
];

function getInitialsColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? "#6366f1";
}

export function UserAvatar({
  avatarUrl,
  username,
  size = 32,
  className = "",
}: UserAvatarProps) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const initials = username.slice(0, 2).toUpperCase();
  const bg = getInitialsColor(username);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
}
