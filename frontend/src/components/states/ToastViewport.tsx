"use client";

import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useToastStore } from "@/lib/toast";

export function ToastViewport() {
  const id = useToastStore((state) => state.id);
  const message = useToastStore((state) => state.message);
  const severity = useToastStore((state) => state.severity);
  const open = useToastStore((state) => state.open);
  const duration = useToastStore((state) => state.duration);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <Snackbar
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      autoHideDuration={duration}
      key={id}
      onClose={dismiss}
      open={open}
    >
      <Alert
        onClose={dismiss}
        role="status"
        aria-live="polite"
        severity={severity}
        variant="filled"
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
