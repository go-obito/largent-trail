import { create } from "zustand";

export type ToastSeverity = "success" | "error" | "info" | "warning";

type ToastState = {
  id: number;
  message: string;
  severity: ToastSeverity;
  open: boolean;
  show: (message: string, severity?: ToastSeverity) => void;
  dismiss: () => void;
};

let nextToastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  id: 0,
  message: "",
  severity: "info",
  open: false,
  show: (message, severity = "info") =>
    set({
      id: ++nextToastId,
      message,
      severity,
      open: true,
    }),
  dismiss: () => set({ open: false }),
}));

export function showToast(message: string, severity?: ToastSeverity) {
  useToastStore.getState().show(message, severity);
}
