"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ChevronDown, ChevronUp, Ellipsis, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";
import { OfflineBanner } from "@/components/states/OfflineBanner";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useBudgets } from "@/features/budgets/api";
import { useCategories, useDeleteCategory, useUpdateCategory } from "@/features/categories/api";
import { categoryErrorMessage } from "@/features/categories/errors";
import { CategoryInUseDialog } from "@/features/categories/components/CategoryInUseDialog";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { showToast } from "@/lib/toast";

type CategoryRead = components["schemas"]["CategoryRead"];
type CategoryKind = components["schemas"]["CategoryKind"];
type BudgetRead = components["schemas"]["BudgetRead"];
const noCategories: CategoryRead[] = [];

const kindNames: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
};

function CategoryRow({
  category,
  index,
  count,
  isOnline,
  isReordering,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onMove,
}: {
  category: CategoryRead;
  index: number;
  count: number;
  isOnline: boolean;
  isReordering: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const closeMenu = () => setAnchor(null);

  return (
    <li className="flex min-h-[76px] items-center gap-3 border-b border-outline py-3 last:border-b-0">
      {!category.is_archived && (
        <div className="flex shrink-0 flex-col">
          <IconButton
            aria-label={`Move ${category.name} up`}
            disabled={!isOnline || isReordering || index === 0}
            onClick={() => onMove(-1)}
            size="small"
            sx={{ minHeight: 28, minWidth: 36 }}
          >
            <ChevronUp aria-hidden="true" size={17} />
          </IconButton>
          <IconButton
            aria-label={`Move ${category.name} down`}
            disabled={!isOnline || isReordering || index === count - 1}
            onClick={() => onMove(1)}
            size="small"
            sx={{ minHeight: 28, minWidth: 36 }}
          >
            <ChevronDown aria-hidden="true" size={17} />
          </IconButton>
        </div>
      )}
      <CategoryBadge icon={category.icon} name={category.name} />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {category.name}
        {category.is_archived && (
          <span className="ml-2 text-xs font-normal text-muted">Archived</span>
        )}
      </span>
      <IconButton
        aria-label={`Actions for ${category.name}`}
        disabled={!isOnline}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minHeight: 44, minWidth: 44 }}
      >
        <Ellipsis aria-hidden="true" size={20} />
      </IconButton>
      <Menu anchorEl={anchor} onClose={closeMenu} open={Boolean(anchor)}>
        <MenuItem
          onClick={() => {
            closeMenu();
            onEdit();
          }}
        >
          Edit
        </MenuItem>
        {category.is_archived ? (
          <MenuItem
            onClick={() => {
              closeMenu();
              onUnarchive();
            }}
          >
            Unarchive
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              closeMenu();
              onArchive();
            }}
          >
            Archive
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            closeMenu();
            onDelete();
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </li>
  );
}

export function CategoryManager() {
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRead | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CategoryRead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRead | null>(null);
  const [inUseTarget, setInUseTarget] = useState<CategoryRead | null>(null);
  const [actionError, setActionError] = useState("");
  const categoriesQuery = useCategories({ kind, includeArchived: true });
  const budgetsQuery = useBudgets();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const categories = categoriesQuery.data ?? noCategories;
  const activeCategories = useMemo(
    () => categories.filter((category) => !category.is_archived),
    [categories],
  );
  const archivedCategories = useMemo(
    () => categories.filter((category) => category.is_archived),
    [categories],
  );
  const deletingBudgets = (category: CategoryRead): BudgetRead[] =>
    (budgetsQuery.data ?? []).filter(
      (budget) => budget.category_id === category.id,
    );

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function archiveCategory(category: CategoryRead) {
    setActionError("");
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        changes: { is_archived: !category.is_archived },
      });
      setArchiveTarget(null);
      setInUseTarget(null);
      showToast(
        category.is_archived ? "Category unarchived" : "Category archived",
        "success",
      );
    } catch (error) {
      setActionError(categoryErrorMessage(error, category.kind));
    }
  }

  async function removeCategory(category: CategoryRead, reassignTo?: string) {
    setActionError("");
    try {
      await deleteCategory.mutateAsync({ id: category.id, reassignTo });
      setDeleteTarget(null);
      setInUseTarget(null);
      showToast("Category deleted", "success");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "category_in_use"
      ) {
        setDeleteTarget(null);
        setInUseTarget(category);
        return;
      }
      setActionError(categoryErrorMessage(error, category.kind));
    }
  }

  async function moveCategory(category: CategoryRead, direction: -1 | 1) {
    const currentIndex = activeCategories.findIndex(
      (item) => item.id === category.id,
    );
    if (!activeCategories[currentIndex + direction]) return;
    const reorderedActive = [...activeCategories];
    const [movingCategory] = reorderedActive.splice(currentIndex, 1);
    reorderedActive.splice(currentIndex + direction, 0, movingCategory);
    const orderedCategories = [
      ...reorderedActive,
      ...archivedCategories,
    ];
    setActionError("");
    try {
      await Promise.all(
        orderedCategories.flatMap((item, position) =>
          item.position === position
            ? []
            : [
                updateCategory.mutateAsync({
                  id: item.id,
                  changes: { position },
                }),
              ],
        ),
      );
    } catch (error) {
      setActionError(categoryErrorMessage(error, category.kind));
    }
  }

  if (categoriesQuery.isPending && !categoriesQuery.data) {
    return (
      <div className="space-y-4">
        <OfflineBanner />
        <LoadingSkeleton label="Loading categories" rows={4} />
      </div>
    );
  }

  if (categoriesQuery.isError && !categoriesQuery.data) {
    return (
      <div className="space-y-4">
        <OfflineBanner />
        <ErrorState
          description="We couldn't load your categories. Check your connection and try again."
          onRetry={() => void categoriesQuery.refetch()}
        />
      </div>
    );
  }

  function openCreateForm() {
    setEditingCategory(null);
    setFormOpen(true);
  }

  function openEditForm(category: CategoryRead) {
    setEditingCategory(category);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <OfflineBanner />
      {categoriesQuery.isError && categoriesQuery.data && (
        <Alert severity="info">
          Showing saved categories. They couldn&apos;t be refreshed just now.
        </Alert>
      )}
      {actionError && (
        <Alert
          aria-live="polite"
          onClose={() => setActionError("")}
          severity="error"
        >
          {actionError}
        </Alert>
      )}
      <div
        aria-label="Category type"
        className="grid max-w-sm grid-cols-2 rounded-2xl bg-panel-raised p-1"
        role="group"
      >
        {(["expense", "income"] as CategoryKind[]).map((value) => (
          <button
            aria-pressed={kind === value}
            className={`min-h-11 rounded-xl px-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              kind === value
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:bg-panel/60"
            }`}
            key={value}
            onClick={() => {
              setKind(value);
              setActionError("");
            }}
            type="button"
          >
            {kindNames[value]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {kindNames[kind]} categories
        </h2>
        <Button
          disabled={!isOnline}
          onClick={openCreateForm}
          startIcon={<Plus aria-hidden="true" size={18} />}
          sx={{ minHeight: 44 }}
          title={!isOnline ? "You're offline. Changes need a connection." : undefined}
          variant="contained"
        >
          Add category
        </Button>
      </div>

      {activeCategories.length === 0 ? (
        <EmptyState
          description="Add a category to keep this kind of spending organized."
          title={`No ${kind} categories yet`}
        >
          <Button
            className="mt-4"
            disabled={!isOnline}
            onClick={openCreateForm}
            sx={{ minHeight: 44 }}
            variant="contained"
          >
            Add {kind} category
          </Button>
        </EmptyState>
      ) : (
        <ul className="card-surface px-4">
          {activeCategories.map((category, index) => (
            <CategoryRow
              category={category}
              count={activeCategories.length}
              index={index}
              isOnline={isOnline}
              isReordering={updateCategory.isPending}
              key={category.id}
              onArchive={() => setArchiveTarget(category)}
              onDelete={() => setDeleteTarget(category)}
              onEdit={() => openEditForm(category)}
              onMove={(direction) => void moveCategory(category, direction)}
              onUnarchive={() => void archiveCategory(category)}
            />
          ))}
        </ul>
      )}

      {archivedCategories.length > 0 && (
        <details className="card-surface px-4">
          <summary className="min-h-12 cursor-pointer font-semibold text-foreground">
            Archived ({archivedCategories.length})
          </summary>
          <ul className="border-t border-outline">
            {archivedCategories.map((category) => (
              <CategoryRow
                category={category}
                count={archivedCategories.length}
                index={-1}
                isOnline={isOnline}
                isReordering={false}
                key={category.id}
                onArchive={() => setArchiveTarget(category)}
                onDelete={() => setDeleteTarget(category)}
                onEdit={() => openEditForm(category)}
                onMove={() => undefined}
                onUnarchive={() => void archiveCategory(category)}
              />
            ))}
          </ul>
        </details>
      )}

      {formOpen && (
        <CategoryFormDialog
          category={editingCategory}
          initialKind={kind}
          key={editingCategory?.id ?? `new-${kind}`}
          onClose={() => setFormOpen(false)}
          open
        />
      )}

      <Dialog
        onClose={() => !updateCategory.isPending && setArchiveTarget(null)}
        open={Boolean(archiveTarget)}
      >
        <DialogTitle>Archive category?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted">
            Archived categories disappear from pickers. Existing transactions
            and budgets are kept.
          </p>
          {actionError && (
            <p aria-live="polite" className="mt-3 text-sm text-status-error" role="alert">
              {actionError}
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={updateCategory.isPending}
            onClick={() => setArchiveTarget(null)}
          >
            Cancel
          </Button>
          <Button
            disabled={!isOnline || updateCategory.isPending}
            onClick={() => archiveTarget && void archiveCategory(archiveTarget)}
            variant="contained"
          >
            {updateCategory.isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        onClose={() => !deleteCategory.isPending && setDeleteTarget(null)}
        open={Boolean(deleteTarget)}
      >
        <DialogTitle>Delete category?</DialogTitle>
        <DialogContent className="space-y-3">
          <p className="text-sm text-muted">
            This will permanently delete {deleteTarget?.name}.
          </p>
          {deleteTarget &&
            deletingBudgets(deleteTarget).map((budget) => (
              <p className="text-sm text-muted" key={budget.id}>
                Your {budget.period} budget for {deleteTarget.name} will also be
                deleted.
              </p>
            ))}
          {budgetsQuery.isPending && !budgetsQuery.data && (
            <p className="text-sm text-muted">Checking your budgets…</p>
          )}
          {budgetsQuery.isError && !budgetsQuery.data && (
            <div className="space-y-2">
              <p
                aria-live="polite"
                className="text-sm text-status-error"
                role="alert"
              >
                Your budgets couldn&apos;t be checked. Retry before deleting this
                category.
              </p>
              <Button
                onClick={() => void budgetsQuery.refetch()}
                sx={{ minHeight: 44 }}
                variant="outlined"
              >
                Retry budgets
              </Button>
            </div>
          )}
          {actionError && (
            <p aria-live="polite" className="text-sm text-status-error" role="alert">
              {actionError}
            </p>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={deleteCategory.isPending}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            color="error"
            disabled={
              !isOnline ||
              deleteCategory.isPending ||
              (!budgetsQuery.data && budgetsQuery.isPending) ||
              (!budgetsQuery.data && budgetsQuery.isError)
            }
            onClick={() =>
              deleteTarget && void removeCategory(deleteTarget)
            }
            variant="contained"
          >
            {deleteCategory.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {inUseTarget && (
        <CategoryInUseDialog
          category={inUseTarget}
          isArchiving={updateCategory.isPending}
          isReassigning={deleteCategory.isPending}
          onArchive={() => void archiveCategory(inUseTarget)}
          onClose={() => setInUseTarget(null)}
          onReassign={(replacementId) =>
            void removeCategory(inUseTarget, replacementId)
          }
          open
          replacementCategories={activeCategories}
        />
      )}
    </div>
  );
}
