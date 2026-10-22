"use client";

import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Ellipsis,
  ExternalLink,
  Target,
} from "lucide-react";
import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import {
  domainOf,
  priorityColor,
  priorityLabel,
} from "@/features/needs/helpers";

type NeedRead = components["schemas"]["NeedRead"];

export function NeedCard({
  index,
  isOnline,
  isReorderPending,
  need,
  count,
  onAllocate,
  onDelete,
  onEdit,
  onMove,
  onShowActivity,
}: {
  index: number;
  isOnline: boolean;
  isReorderPending: boolean;
  need: NeedRead;
  count: number;
  onAllocate: (need: NeedRead) => void;
  onDelete: (need: NeedRead) => void;
  onEdit: (need: NeedRead) => void;
  onMove: (need: NeedRead, direction: "up" | "down") => void;
  onShowActivity: (need: NeedRead) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const sourceDomain = need.source_url ? domainOf(need.source_url) : "";
  const progressWidth = Math.min(100, Math.max(0, need.percent));
  const remainingMinor = need.is_complete ? 0 : need.remaining_minor;

  return (
    <article className="card-surface flex min-h-[310px] flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-selected-surface text-primary">
          <Target aria-hidden="true" size={21} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-foreground">{need.name}</h2>
          <span
            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityColor(need.priority)}`}
          >
            {priorityLabel(need.priority)} priority
          </span>
        </div>
        <IconButton
          aria-expanded={Boolean(menuAnchor)}
          aria-haspopup="menu"
          aria-label={`Actions for ${need.name}`}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ flexShrink: 0, minHeight: 44, minWidth: 44, mt: -1, mr: -1 }}
        >
          <Ellipsis aria-hidden="true" size={20} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          open={Boolean(menuAnchor)}
        >
          <MenuItem
            disabled={!isOnline}
            onClick={() => {
              setMenuAnchor(null);
              onEdit(need);
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onShowActivity(need);
            }}
          >
            Activity
          </MenuItem>
          <MenuItem
            disabled={!isOnline}
            onClick={() => {
              setMenuAnchor(null);
              onDelete(need);
            }}
          >
            Delete
          </MenuItem>
        </Menu>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Target</p>
        <p className="font-semibold tabular-nums text-foreground">
          {formatGhs(need.target_minor)}
        </p>
      </div>
      <div className="mt-4">
        <div
          aria-label={`${need.name} progress`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressWidth}
          aria-valuetext={`${need.percent}%`}
          className="h-2 overflow-hidden rounded-full bg-panel-raised"
          role="progressbar"
        >
          <span
            className={`block h-full rounded-full transition-[width] duration-200 ${
              need.is_complete ? "bg-status-success" : "bg-primary"
            }`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold tabular-nums text-foreground">
            {need.percent}%
          </span>
          {need.is_complete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))] px-2.5 py-1 text-xs font-semibold text-status-success">
              <Check aria-hidden="true" size={14} />
              Goal reached
            </span>
          ) : (
            <span className="text-muted">In progress</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Saved {formatGhs(need.allocated_minor)}</span>
        <span className="text-muted">
          Remaining {formatGhs(remainingMinor)}
        </span>
      </div>
      {(sourceDomain || need.note) && (
        <div className="mt-3 min-h-8 space-y-2">
          {sourceDomain && need.source_url && (
            <a
              className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-panel-raised px-3 py-1 text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href={need.source_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={13} />
              <span className="truncate">{sourceDomain}</span>
            </a>
          )}
          {need.note && (
            <p className="line-clamp-2 text-sm leading-5 text-muted">
              {need.note}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <button
          className="min-h-11 flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:bg-primary-pressed disabled:cursor-not-allowed disabled:bg-disabled"
          disabled={!isOnline}
          onClick={() => onAllocate(need)}
          type="button"
        >
          Set money aside
        </button>
        <IconButton
          aria-label={`Move ${need.name} up`}
          disabled={!isOnline || isReorderPending || index === 0}
          onClick={() => onMove(need, "up")}
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          <ArrowUp aria-hidden="true" size={18} />
        </IconButton>
        <IconButton
          aria-label={`Move ${need.name} down`}
          disabled={!isOnline || isReorderPending || index === count - 1}
          onClick={() => onMove(need, "down")}
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          <ArrowDown aria-hidden="true" size={18} />
        </IconButton>
      </div>
    </article>
  );
}
