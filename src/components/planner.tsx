"use client";

import {
  CaretDownIcon,
  MapPinLineIcon,
  MinusIcon,
  PlusIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DestinationForm } from "@/components/destination-form";
import { DestinationList } from "@/components/destination-list";
import { ProfileManager } from "@/components/profile-manager";
import { useTrip } from "@/components/trip-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { comparableEntries, rank } from "@/lib/calc";
import { formatHuf } from "@/lib/format";
import {
  type Destination,
  SORT_KEYS,
  SORT_LABELS,
  type SortKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function Planner() {
  const { store, profile, state, dispatch, hydrated } = useTrip();
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [profilesOpen, setProfilesOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const formWrapperRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(
    () => rank(state.destinations, state.people, sortKey),
    [state.destinations, state.people, sortKey],
  );

  const editing = editingId
    ? (state.destinations.find((d) => d.id === editingId) ?? null)
    : null;

  const openForm = useCallback((destination: Destination | null) => {
    setEditingId(destination?.id ?? null);
    setFormOpen(true);
    // Let the form mount before scrolling it into view.
    requestAnimationFrame(() => {
      formWrapperRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    addButtonRef.current?.focus();
  }, []);

  // `N` opens the form from anywhere that isn't a text field, which is the
  // whole point of a research console: paste, save, next.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openForm(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openForm]);

  function handleSave(destination: Destination) {
    dispatch({ type: "saveDestination", destination });
    setAnnouncement(`${destination.place} elmentve.`);
    closeForm();
  }

  // 1-based position of the active profile, so the header button says which
  // of several plans is on screen without opening the panel.
  const activeIndex =
    store.profiles.findIndex((p) => p.id === store.activeProfileId) + 1;

  const cheapest = entries.find((e) => e.isCheapest);
  // The summary counts only what can honestly be compared. A flight-only
  // destination in this count would make the spread look narrower than it is.
  const comparable = comparableEntries(entries);
  const comparableCount = comparable.length;
  const spread =
    comparableCount > 1
      ? Math.max(...comparable.map((e) => e.derived.tripTotal)) -
        (cheapest?.derived.tripTotal ?? 0)
      : null;
  // Surfaced so the header can say plainly that some rows are sitting out.
  const partialCount = entries.filter(
    (e) => e.derived.priced && !e.derived.comparable,
  ).length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-(--z-sticky) border-border border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-[80rem] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MapPinLineIcon
                aria-hidden="true"
                className="text-secondary"
                weight="fill"
              />
              Nyaraláshasonlító
            </h1>
            {hydrated && (comparableCount > 0 || partialCount > 0) ? (
              <p className="hidden text-xs text-muted-foreground sm:block">
                <span className="numeric text-foreground">
                  {comparableCount}
                </span>{" "}
                összevethető úti cél
                {cheapest ? (
                  <>
                    {" · legolcsóbb: "}
                    <span className="text-foreground">
                      {cheapest.destination.place}
                    </span>{" "}
                    <span className="numeric text-secondary">
                      {formatHuf(cheapest.derived.tripTotal)}
                    </span>
                  </>
                ) : null}
                {spread && spread > 0 ? (
                  <>
                    {" · szórás: "}
                    <span className="numeric text-foreground">
                      {formatHuf(spread)}
                    </span>
                  </>
                ) : null}
                {/* Said out loud rather than left for the user to notice, so
                    the headline figures are never quietly based on a subset. */}
                {partialCount > 0 ? (
                  <>
                    {" · "}
                    <span className="text-destructive">
                      <span className="numeric">{partialCount}</span> kimarad
                      hiányzó ár miatt
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <Button
              aria-controls="profile-manager"
              aria-expanded={profilesOpen}
              className="gap-1.5"
              onClick={() => setProfilesOpen((open) => !open)}
              size="sm"
              variant="outline"
            >
              <span className="max-w-[10rem] truncate">{profile.name}</span>
              {store.profiles.length > 1 ? (
                <span className="numeric text-muted-foreground">
                  {activeIndex}/{store.profiles.length}
                </span>
              ) : null}
              <CaretDownIcon
                aria-hidden="true"
                className={cn(
                  "transition-transform duration-200 ease-[var(--ease-out-quart)]",
                  profilesOpen && "rotate-180",
                )}
              />
            </Button>
            <PeopleStepper
              onChange={(people) => dispatch({ type: "setPeople", people })}
              value={state.people}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[80rem] flex-1 px-4 py-6">
        {profilesOpen ? (
          <div
            className="mb-6 border border-border bg-card/30"
            id="profile-manager"
          >
            <ProfileManager
              activeProfileId={store.activeProfileId}
              onClose={() => setProfilesOpen(false)}
              onCreate={(name) => {
                dispatch({ type: "createProfile", name });
                setAnnouncement("Új profil létrehozva.");
              }}
              onDelete={(id) => {
                dispatch({ type: "deleteProfile", id });
                setAnnouncement("Profil törölve.");
              }}
              onDuplicate={(id) => dispatch({ type: "duplicateProfile", id })}
              onImport={(incoming) => {
                dispatch({ type: "importProfiles", profiles: incoming });
                setAnnouncement(`${incoming.length} profil betöltve.`);
              }}
              onRename={(id, name) =>
                dispatch({ type: "renameProfile", id, name })
              }
              onSwitch={(id) => {
                dispatch({ type: "switchProfile", id });
                closeForm();
              }}
              profiles={store.profiles}
            />
          </div>
        ) : null}

        <div className="border border-border bg-card/30" ref={formWrapperRef}>
          {formOpen ? (
            <DestinationForm
              editing={editing}
              key={editingId ?? "new"}
              onCancel={closeForm}
              onSave={handleSave}
              people={state.people}
            />
          ) : (
            <Button
              className="h-11 w-full justify-start px-4 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => openForm(null)}
              ref={addButtonRef}
              variant="ghost"
            >
              <PlusIcon
                aria-hidden="true"
                data-icon="inline-start"
                weight="bold"
              />
              Új úti cél
              {/* Pointless on a touch device, where there is no key to press. */}
              <kbd className="numeric ml-auto hidden border border-border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground sm:inline-block">
                N
              </kbd>
            </Button>
          )}
        </div>

        <section aria-label="Mentett úti célok" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            <h2 className="text-xs font-medium text-foreground">
              Úti célok{" "}
              <span className="numeric text-muted-foreground">
                ({state.destinations.length})
              </span>
            </h2>
            {state.destinations.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="field-label" id="sort-label">
                  Rendezés
                </span>
                <Select
                  items={SORT_KEYS.map((key) => ({
                    label: SORT_LABELS[key],
                    value: key,
                  }))}
                  onValueChange={(value) => setSortKey(value as SortKey)}
                  value={sortKey}
                >
                  <SelectTrigger aria-labelledby="sort-label" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {SORT_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {!hydrated ? (
            <ListSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState onStart={() => openForm(null)} />
          ) : (
            <DestinationList
              entries={entries}
              onChooseHotel={(destinationId, hotelId) =>
                dispatch({ type: "chooseHotel", destinationId, hotelId })
              }
              onEdit={(destination) => openForm(destination)}
              onRemove={(id) => {
                dispatch({ type: "removeDestination", id });
                setAnnouncement("Úti cél törölve.");
              }}
              people={state.people}
            />
          )}
        </section>
      </main>

      {/* Save and delete are silent visually — the row just appears or goes.
          Screen-reader users get the confirmation they'd otherwise miss. */}
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
    </div>
  );
}

function PeopleStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="field-label flex items-center gap-1.5" id="people-label">
        <UsersIcon aria-hidden="true" />
        Fő
      </span>
      <div className="flex items-center border border-input">
        <Button
          aria-label="Eggyel kevesebb fő"
          className="border-0"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          size="icon-sm"
          variant="ghost"
        >
          <MinusIcon aria-hidden="true" weight="bold" />
        </Button>
        <input
          aria-labelledby="people-label"
          className="numeric h-7 w-9 border-input border-x bg-transparent text-center text-xs outline-none focus-visible:bg-input/30"
          inputMode="numeric"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            if (digits) onChange(Number.parseInt(digits, 10));
          }}
          value={value}
        />
        <Button
          aria-label="Eggyel több fő"
          className="border-0"
          disabled={value >= 20}
          onClick={() => onChange(value + 1)}
          size="icon-sm"
          variant="ghost"
        >
          <PlusIcon aria-hidden="true" weight="bold" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-border border-dashed px-6 py-10">
      <div className="flex max-w-[62ch] flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">
          Még nincs mit összehasonlítani
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Vegyél fel egy helyet a dátumaival, a talált repülőjárattal és a
          szállásokkal, amiket mérlegelsz. Az éjszakák számát, az éjszakai díjat
          és a fejenkénti összegeket kiszámolom, a szállás nevét és képét pedig
          egyenesen a Booking- vagy Airbnb-linkből olvasom ki — így csak azt
          kell begépelned, aminek amúgy is utánanéztél.
        </p>
      </div>
      <dl className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
        <Hint term="Te adod meg">
          Hely, dátumok, menetrend, árak, szálláslinkek
        </Hint>
        <Hint term="Ezt kiszámolja">
          Éjszakák, éjszakai díj, fejenkénti és napi költség, különbségek
        </Hint>
        <Hint term="Ezt lekéri">
          A szállás nevét, képét és helyét a hirdetésből
        </Hint>
      </dl>
      <Button onClick={onStart}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" weight="bold" />
        Első úti cél felvétele
      </Button>
    </div>
  );
}

function Hint({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="field-label">{term}</dt>
      <dd className="text-muted-foreground">{children}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="border-border border-t" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <li
          className="flex items-center justify-between gap-4 border-border border-b px-4 py-4"
          key={row}
        >
          <div className="flex w-full max-w-sm flex-col gap-2">
            <span className="h-3.5 w-40 animate-pulse bg-muted-foreground/15" />
            <span className="h-2.5 w-56 animate-pulse bg-muted-foreground/10" />
          </div>
          <span className="h-5 w-24 animate-pulse bg-muted-foreground/15" />
        </li>
      ))}
    </ul>
  );
}
