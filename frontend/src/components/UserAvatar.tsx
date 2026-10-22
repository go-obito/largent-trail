import Avatar from "@mui/material/Avatar";

export function UserAvatar({
  name,
  imageUrl,
  size,
}: {
  name: string;
  imageUrl?: string;
  size: number;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Avatar
      alt={name}
      aria-label={name ? `${name} avatar` : "Account avatar"}
      src={imageUrl}
      sx={{
        width: size,
        height: size,
        bgcolor: "var(--color-selected-surface)",
        color: "var(--color-primary)",
        fontWeight: 700,
      }}
    >
      {initials || "?"}
    </Avatar>
  );
}
