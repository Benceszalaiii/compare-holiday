"use client";

import {
  ClipboardIcon,
  DownloadSimpleIcon,
  PlusIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateLong } from "@/lib/format";
import {
  decodeTransfer,
  describeTransfer,
  encodeTransfer,
  type TransferProfile,
} from "@/lib/transfer";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

type Scope = "active" | "all";

export function ProfileManager({
  profiles,
  activeProfileId,
  onSwitch,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
  onClose,
}: {
  profiles: Profile[];
  activeProfileId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (incoming: TransferProfile[]) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const newNameId = useId();

  return (
    <section
      aria-label="Profilok kezelése"
      className="flex flex-col"
      onKeyDown={(event) => {
        // Only close the panel when no dialog is holding the keystroke.
        if (event.key === "Escape" && !exportOpen && !importOpen) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-2.5">
        <h2 className="text-xs font-medium text-foreground">Profilok</h2>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={() => setExportOpen(true)}
            size="sm"
            variant="outline"
          >
            <DownloadSimpleIcon aria-hidden="true" data-icon="inline-start" />
            Kimentés
          </Button>
          <Button
            onClick={() => setImportOpen(true)}
            size="sm"
            variant="outline"
          >
            <UploadSimpleIcon aria-hidden="true" data-icon="inline-start" />
            Betöltés
          </Button>
          <Button
            aria-label="Profilkezelő bezárása"
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <ul className="flex flex-col divide-y divide-border border border-border">
          {profiles.map((profile) => (
            <ProfileRow
              isActive={profile.id === activeProfileId}
              key={profile.id}
              onDelete={() => onDelete(profile.id)}
              onDuplicate={() => onDuplicate(profile.id)}
              onRename={(name) => onRename(profile.id, name)}
              onSwitch={() => onSwitch(profile.id)}
              profile={profile}
            />
          ))}
        </ul>

        <div className="flex max-w-md gap-1.5">
          <label className="sr-only" htmlFor={newNameId}>
            Új profil neve
          </label>
          <Input
            autoComplete="off"
            id={newNameId}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreate(newName);
                setNewName("");
              }
            }}
            placeholder="Új profil neve, pl. Nyár 2027"
            value={newName}
          />
          <Button
            onClick={() => {
              onCreate(newName);
              setNewName("");
            }}
            type="button"
            variant="outline"
          >
            <PlusIcon
              aria-hidden="true"
              data-icon="inline-start"
              weight="bold"
            />
            Létrehoz
          </Button>
        </div>
      </div>

      <ExportDialog
        activeProfileId={activeProfileId}
        onOpenChange={setExportOpen}
        open={exportOpen}
        profiles={profiles}
      />
      <ImportDialog
        onImport={onImport}
        onOpenChange={setImportOpen}
        open={importOpen}
      />
    </section>
  );
}

/* ------------------------------------------------------------------- rows */

function ProfileRow({
  profile,
  isActive,
  onSwitch,
  onRename,
  onDuplicate,
  onDelete,
}: {
  profile: Profile;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const destinations = profile.trip.destinations.length;

  function commitRename() {
    const next = draftName.trim();
    if (next && next !== profile.name) onRename(next);
    else setDraftName(profile.name);
    setEditing(false);
  }

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-2.5 py-2 transition-colors",
        isActive ? "bg-secondary/10" : "hover:bg-muted/40",
      )}
    >
      {editing ? (
        <Input
          aria-label="Profil neve"
          className="h-7 max-w-xs"
          onBlur={commitRename}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              setDraftName(profile.name);
              setEditing(false);
            }
          }}
          // Focus follows the click that revealed this field, so renaming is
          // one action rather than two.
          ref={(node) => node?.focus()}
          value={draftName}
        />
      ) : (
        <button
          // `aria-current` is the honest semantic for "the one of these that
          // is in use" — it announces as current without pretending the row
          // is a checkbox that can be unticked.
          aria-current={isActive ? "true" : undefined}
          // Without this the row's four separate spans are announced as one
          // run-on string ("Nyár 2027Váltás erre1 úti célmódosítva…").
          aria-label={
            isActive
              ? `${profile.name} — jelenleg aktív, ${destinations} úti cél`
              : `${profile.name} — váltás erre, ${destinations} úti cél`
          }
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:underline disabled:cursor-default"
          disabled={isActive}
          onClick={onSwitch}
          type="button"
        >
          <span
            className={cn(
              "truncate text-xs",
              isActive ? "font-medium text-secondary" : "text-foreground",
            )}
          >
            {profile.name}
          </span>
          {isActive ? (
            <span className="shrink-0 border border-secondary/50 px-1.5 py-0.5 text-[0.625rem] font-medium text-secondary">
              Aktív
            </span>
          ) : (
            // The affordance has to be visible, not just implied by a hover
            // colour, since the whole row is the target.
            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
              Váltás erre
            </span>
          )}
          <span className="numeric shrink-0 text-[0.6875rem] text-muted-foreground">
            {destinations} úti cél
          </span>
          <span className="hidden shrink-0 text-[0.6875rem] text-muted-foreground md:inline">
            módosítva{" "}
            {formatDateLong(new Date(profile.updatedAt).toISOString())}
          </span>
        </button>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {!editing ? (
          <Button
            aria-label={`${profile.name} átnevezése`}
            onClick={() => {
              setDraftName(profile.name);
              setEditing(true);
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            Átnevez
          </Button>
        ) : null}
        <Button
          aria-label={`${profile.name} másolása`}
          onClick={onDuplicate}
          size="xs"
          type="button"
          variant="ghost"
        >
          Másolat
        </Button>
        {confirmingDelete ? (
          <>
            <span className="text-[0.6875rem] text-muted-foreground">
              Törlöd?
            </span>
            <Button
              onClick={onDelete}
              size="xs"
              type="button"
              variant="destructive"
            >
              Igen
            </Button>
            <Button
              onClick={() => setConfirmingDelete(false)}
              size="xs"
              type="button"
              variant="ghost"
            >
              Mégse
            </Button>
          </>
        ) : (
          <Button
            aria-label={`${profile.name} törlése`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmingDelete(true)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <TrashIcon aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- dialogs */

function ExportDialog({
  profiles,
  activeProfileId,
  open,
  onOpenChange,
}: {
  profiles: Profile[];
  activeProfileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = useState<Scope>("active");
  const areaId = useId();

  const selected =
    scope === "all"
      ? profiles
      : profiles.filter((p) => p.id === activeProfileId);
  const code = encodeTransfer(selected);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Kimentés</DialogTitle>
          <DialogDescription>
            Másold ki a kódot, és illeszd be a másik gépen a Betöltés ablakba.
            Egyetlen sor, szóköz nélkül — e-mailben és chatben is épségben átér.
          </DialogDescription>
        </DialogHeader>

        <fieldset
          aria-label="Mit mentsünk ki"
          className="flex w-fit border border-input p-0"
        >
          <ScopeButton
            active={scope === "active"}
            label="Csak az aktív"
            onClick={() => setScope("active")}
          />
          <ScopeButton
            active={scope === "all"}
            label={`Mind (${profiles.length})`}
            onClick={() => setScope("all")}
          />
        </fieldset>

        <label className="sr-only" htmlFor={areaId}>
          Kimentett kód
        </label>
        <textarea
          className="numeric h-32 w-full resize-y border border-input bg-transparent px-2.5 py-2 text-[0.6875rem] break-all outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
          id={areaId}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={code}
        />

        <DialogFooter className="items-center">
          <span className="numeric mr-auto text-[0.6875rem] text-muted-foreground">
            {describeTransfer(selected)}
          </span>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Bezár
          </Button>
          <CopyButton
            ariaLabel="Kód másolása a vágólapra"
            // The code is on screen either way, so a refused clipboard write
            // has an obvious manual fallback worth naming.
            failedLabel="Jelöld ki és Ctrl+C"
            label="Másolás"
            size="default"
            text={() => code}
            variant="default"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "h-7 px-2.5 text-xs transition-colors outline-none",
        "focus-visible:ring-1 focus-visible:ring-ring/50",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ImportDialog({
  onImport,
  open,
  onOpenChange,
}: {
  onImport: (incoming: TransferProfile[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const areaId = useId();

  function reset() {
    setText("");
    setError(null);
  }

  function handleImport() {
    const result = decodeTransfer(text);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    onImport(result.profiles);
    reset();
    onOpenChange(false);
  }

  /** Reads the clipboard straight into the box, when the browser allows it. */
  async function handlePaste() {
    try {
      const clip = await navigator.clipboard?.readText();
      if (clip) {
        setText(clip);
        setError(null);
        return;
      }
    } catch {
      // Permission denied, or a non-secure context over plain HTTP.
    }
    setError("A böngésző nem engedte a beillesztést — használd a Ctrl+V-t.");
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Betöltés</DialogTitle>
          <DialogDescription>
            A betöltés mindig új profilként jön létre — a meglévő adataidat
            semmi nem írja felül. Az azonos nevek sorszámot kapnak.
          </DialogDescription>
        </DialogHeader>

        <label className="sr-only" htmlFor={areaId}>
          Betöltendő kód
        </label>
        <textarea
          aria-describedby={error ? `${areaId}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            "numeric h-32 w-full resize-y border border-input bg-transparent px-2.5 py-2 text-[0.6875rem] break-all outline-none",
            "placeholder:font-sans placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30",
            error && "border-destructive",
          )}
          id={areaId}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Illeszd ide a másik gépen kimásolt kódot…"
          spellCheck={false}
          value={text}
        />

        {error ? (
          <p
            className="flex items-start gap-1.5 text-[0.6875rem] leading-tight text-destructive"
            id={`${areaId}-error`}
          >
            <WarningCircleIcon
              aria-hidden="true"
              className="mt-px shrink-0"
              weight="fill"
            />
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            className="mr-auto"
            onClick={handlePaste}
            type="button"
            variant="outline"
          >
            <ClipboardIcon aria-hidden="true" data-icon="inline-start" />
            Beillesztés
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Mégse
          </Button>
          <Button disabled={!text.trim()} onClick={handleImport} type="button">
            <UploadSimpleIcon aria-hidden="true" data-icon="inline-start" />
            Betöltés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
