"use client";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { Banknote, ChevronRight, Globe2, LockKeyhole, RotateCcw, Shapes, SunMoon, UserRound, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearPersistedQueryCache } from "@/app/providers";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useMe, useUpdateMe } from "@/features/me/api";
import { onboardingCopy } from "@/features/onboarding/copy";

type EditField = "name" | "timezone" | null;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function ProfileRow({
  label,
  value,
  onClick,
  icon,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3 text-sm font-medium text-foreground">
        {icon}
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <span className="max-w-[45vw] truncate md:max-w-[320px]">{value}</span>
        {onClick && <ChevronRight aria-hidden="true" className="shrink-0" size={17} />}
      </span>
    </>
  );
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-outline last:border-b-0">
      {onClick ? (
        <button
          className="flex min-h-14 w-full items-center justify-between gap-4 text-left focus-visible:outline-2 focus-visible:outline-focus"
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

function DevTokenButton() {
  const { getToken } = useAuth();
  const [isCopying, setIsCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const copyToken = async () => {
    if (isCopying) return;
    setMessage(null);
    setIsCopying(true);
    try {
      const token = await getToken({ skipCache: true });
      if (!token) {
        setMessage("Could not copy the API token. Please try again.");
        return;
      }
      await navigator.clipboard.writeText(token);
      setMessage("API token copied to clipboard.");
    } catch {
      setMessage("Could not copy the API token. Please try again.");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="mt-6">
      <Button disabled={isCopying} onClick={() => void copyToken()} sx={{ minHeight: 44 }} variant="outlined">
        {isCopying ? "Copying API token…" : "Copy API token (dev only)"}
      </Button>
      {message && <p aria-live="polite" className="mt-2 text-sm text-muted" role="status">{message}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const updateMe = useUpdateMe();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [editing, setEditing] = useState<EditField>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (!userId || isSigningOut) return;
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await clearPersistedQueryCache(userId);
      queryClient.clear();
      await clerk.signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
      setIsSigningOut(false);
    }
  };

  const openEditor = (field: Exclude<EditField, null>) => {
    setEditError(null);
    setEditValue(field === "name" ? me.data?.display_name ?? "" : me.data?.timezone ?? "Africa/Accra");
    setEditing(field);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const trimmedValue = editValue.trim();
    if (editing === "name" && !trimmedValue) {
      setEditError("Enter a name before saving.");
      return;
    }
    if (editing === "timezone" && !validTimezone(trimmedValue)) {
      setEditError("Enter a valid IANA timezone, such as Africa/Accra or Europe/London.");
      return;
    }
    setEditError(null);
    try {
      await updateMe.mutateAsync(
        editing === "name"
          ? { display_name: trimmedValue }
          : { timezone: trimmedValue },
      );
      setEditing(null);
    } catch {
      setEditError(`We couldn't update your ${editing === "name" ? "name" : "timezone"}. Please try again.`);
    }
  };

  if (me.isPending) return <LoadingSkeleton label="Loading your profile" rows={4} />;
  if (me.isError || !me.data) return <ErrorState onRetry={() => void me.refetch()} />;

  const displayName = me.data.display_name || user?.fullName || user?.firstName || "Your profile";
  const email = me.data.email || user?.primaryEmailAddress?.emailAddress || "Email unavailable";
  const dialogTitle = editing === "name" ? "Edit name" : "Update timezone";

  return (
    <section className="mx-auto max-w-[720px] space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted">Manage your account and preferences.</p>
      </header>

      <div className="card-surface flex items-center gap-4 p-5">
        <Avatar alt={displayName} src={user?.imageUrl} sx={{ width: 64, height: 64, bgcolor: "var(--color-selected-surface)", color: "var(--color-primary)", fontWeight: 700 }}>
          {initials(displayName)}
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-foreground">{displayName}</h2>
          <p className="mt-1 truncate text-sm text-muted">{email}</p>
        </div>
        <Button onClick={() => clerk.openUserProfile()} sx={{ minHeight: 44 }} variant="outlined">Edit</Button>
      </div>

      <section aria-labelledby="profile-account-heading" className="card-surface px-5">
        <h2 className="pt-5 text-sm font-bold text-foreground" id="profile-account-heading">Account</h2>
        <ProfileRow icon={<UserRound aria-hidden="true" size={17} />} label="Name" onClick={() => openEditor("name")} value={me.data.display_name || "Not set"} />
        <ProfileRow label="Email" value={email} />
        <ProfileRow
          icon={<LockKeyhole aria-hidden="true" size={17} />}
          label="Password and Security"
          onClick={() => clerk.openUserProfile()}
          value="Manage with Clerk"
        />
      </section>

      <section aria-labelledby="profile-manage-heading" className="card-surface px-5">
        <h2 className="pt-5 text-sm font-bold text-foreground" id="profile-manage-heading">Manage</h2>
        <ProfileRow
          icon={<Wallet aria-hidden="true" size={17} />}
          label="Accounts"
          onClick={() => router.push("/profile/accounts")}
          value="Manage your accounts"
        />
        <ProfileRow
          icon={<Shapes aria-hidden="true" size={17} />}
          label="Categories"
          onClick={() => router.push("/budgets?tab=categories")}
          value="Manage your categories"
        />
      </section>

      <section aria-labelledby="profile-preferences-heading" className="card-surface px-5">
        <h2 className="pt-5 text-sm font-bold text-foreground" id="profile-preferences-heading">Preferences</h2>
        <ProfileRow icon={<Banknote aria-hidden="true" size={17} />} label="Currency" value="GHS (Ghana Cedi)" />
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-outline">
          <span className="flex items-center gap-3 text-sm font-medium text-foreground">
            <SunMoon aria-hidden="true" size={17} />
            Theme
          </span>
          <div className="w-36 shrink-0"><ThemeSwitcher /></div>
        </div>
        <ProfileRow icon={<Globe2 aria-hidden="true" size={17} />} label="Timezone" onClick={() => openEditor("timezone")} value={me.data.timezone} />
        <ProfileRow
          icon={<RotateCcw aria-hidden="true" size={17} />}
          label={onboardingCopy.header.replayIntroduction}
          onClick={() => router.push("/onboarding?replay=1")}
          value={onboardingCopy.header.replayIntroductionAction}
        />
      </section>

      {signOutError && <p aria-live="polite" className="text-sm text-alert" role="alert">{signOutError}</p>}
      <Button disabled={isSigningOut} onClick={() => void handleSignOut()} sx={{ minHeight: 44 }} variant="outlined">
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
      {process.env.NODE_ENV !== "production" && <DevTokenButton />}

      <Dialog onClose={() => !updateMe.isPending && setEditing(null)} open={Boolean(editing)}>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent className="min-w-[min(88vw,420px)] pt-2">
          <TextField
            autoFocus
            fullWidth
            label={editing === "name" ? "Name" : "IANA timezone"}
            onChange={(event) => setEditValue(event.target.value)}
            placeholder={editing === "timezone" ? "Africa/Accra" : ""}
            sx={{ mt: 1 }}
            value={editValue}
          />
          {editError && <p aria-live="polite" className="mt-2 text-sm text-alert" role="alert">{editError}</p>}
        </DialogContent>
        <DialogActions>
          <Button disabled={updateMe.isPending} onClick={() => setEditing(null)}>Cancel</Button>
          <Button disabled={updateMe.isPending} onClick={() => void saveEdit()} variant="contained">
            {updateMe.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
