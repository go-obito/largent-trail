import { create } from "zustand";

export type ToastSeverity = "success" | "error" | "info" | "warning";

type ToastState = {
  id: number;
  message: string;
  severity: ToastSeverity;
  open: boolean;
  duration: number;
  show: (message: string, severity?: ToastSeverity, duration?: number) => void;
  dismiss: () => void;
};

let nextToastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  id: 0,
  message: "",
  severity: "info",
  open: false,
  duration: 5000,
  show: (message, severity = "info", duration = 5000) =>
    set({
      id: ++nextToastId,
      message,
      severity,
      duration,
      open: true,
    }),
  dismiss: () => set({ open: false }),
}));

export function showToast(
  message: string,
  severity?: ToastSeverity,
  duration?: number,
) {
  useToastStore.getState().show(message, severity, duration);
}
