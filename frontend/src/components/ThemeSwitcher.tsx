"use client";

import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import { useColorScheme } from "@mui/material/styles";

export type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "largent-theme";

export function ThemeSwitcher() {
  const { mode, setMode } = useColorScheme();

  const changePreference = (event: SelectChangeEvent<ThemePreference>) => {
    const nextPreference = event.target.value as ThemePreference;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setMode(nextPreference);
  };

  return (
    <FormControl fullWidth size="small">
      <Select
        aria-label="Theme"
        onChange={changePreference}
        value={mode ?? "system"}
      >
        <MenuItem value="light">Light</MenuItem>
        <MenuItem value="dark">Dark</MenuItem>
        <MenuItem value="system">System</MenuItem>
      </Select>
    </FormControl>
  );
}
