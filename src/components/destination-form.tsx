"use client";

import {
  AirplaneTakeoffIcon,
  CalendarBlankIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DateField,
  DateTimeField,
  splitDateTime,
} from "@/components/date-time-fields";
import { AirportField, Field, MoneyField, Readout } from "@/components/fields";
import { HotelDrafts } from "@/components/hotel-drafts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { derive, legMinutes } from "@/lib/calc";
import { formatDuration, formatHuf } from "@/lib/format";
import { newId } from "@/lib/id";
import { type Destination, emptyFlight, type Hotel } from "@/lib/types";
import { cn } from "@/lib/utils";

function blankDestination(): Destination {
  return {
    id: newId(),
    place: "",
    arrival: "",
    departure: "",
    flight: emptyFlight(),
    hotels: [],
    chosenHotelId: null,
    notes: "",
    createdAt: Date.now(),
  };
}

type Errors = Partial<Record<"place" | "arrival" | "departure", string>>;

export function DestinationForm({
  editing,
  people,
  onSave,
  onCancel,
}: {
  /** An existing destination to edit, or null to enter a new one. */
  editing: Destination | null;
  people: number;
  onSave: (destination: Destination) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Destination>(
    () => editing ?? blankDestination(),
  );
  const [errors, setErrors] = useState<Errors>({});
  const placeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    placeRef.current?.focus();
  }, []);

  const derived = useMemo(() => derive(draft, people), [draft, people]);

  function patch(update: Partial<Destination>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function patchFlight(update: Partial<Destination["flight"]>) {
    setDraft((current) => ({
      ...current,
      flight: { ...current.flight, ...update },
    }));
  }

  function validate(candidate: Destination): Errors {
    const next: Errors = {};
    if (!candidate.place.trim()) {
      next.place = "Adj nevet a helynek, hogy megkülönböztethesd a sorokat.";
    }
    if (!candidate.arrival) next.arrival = "Válaszd ki az érkezés napját.";
    if (!candidate.departure) next.departure = "Válaszd ki a távozás napját.";
    if (
      candidate.arrival &&
      candidate.departure &&
      candidate.departure <= candidate.arrival
    ) {
      next.departure = "A távozásnak az érkezés után kell lennie.";
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed: Destination = {
      ...draft,
      place: draft.place.trim(),
      notes: draft.notes.trim(),
      chosenHotelId:
        draft.chosenHotelId &&
        draft.hotels.some((h) => h.id === draft.chosenHotelId)
          ? draft.chosenHotelId
          : (draft.hotels[0]?.id ?? null),
    };
    const found = validate(trimmed);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Send focus to the first thing that needs fixing.
      const firstInvalid = formRef.current?.querySelector<HTMLElement>(
        "[aria-invalid=true]",
      );
      firstInvalid?.focus();
      return;
    }
    onSave(trimmed);
  }

  const outboundMinutes = legMinutes(
    draft.flight.outboundDepart,
    draft.flight.outboundArrive,
  );
  const returnMinutes = legMinutes(
    draft.flight.returnDepart,
    draft.flight.returnArrive,
  );

  return (
    <form
      className="flex flex-col"
      noValidate
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onCancel();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          handleSubmit(event);
        }
      }}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <div className="flex items-center justify-between border-border border-b px-4 py-2.5">
        <h2 className="text-xs font-medium text-foreground">
          {editing
            ? `${editing.place || "Úti cél"} szerkesztése`
            : "Új úti cél"}
        </h2>
        <Button
          aria-label="Űrlap bezárása"
          onClick={onCancel}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">
        <Section
          icon={<CalendarBlankIcon aria-hidden="true" />}
          title="Hol és mikor"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_7rem]">
            <Field error={errors.place} label="Hely">
              {({ id, describedBy }) => (
                <Input
                  aria-describedby={describedBy}
                  aria-invalid={errors.place ? true : undefined}
                  autoComplete="off"
                  id={id}
                  onChange={(event) => patch({ place: event.target.value })}
                  placeholder="Bécs, Ausztria"
                  ref={placeRef}
                  value={draft.place}
                />
              )}
            </Field>
            <DateField
              error={errors.arrival}
              label="Érkezés"
              onChange={(iso) => patch({ arrival: iso })}
              value={draft.arrival}
            />
            <DateField
              defaultMonthIso={draft.arrival}
              error={errors.departure}
              label="Távozás"
              min={draft.arrival || undefined}
              onChange={(iso) => patch({ departure: iso })}
              value={draft.departure}
            />
            <Readout
              className="self-end pb-2"
              label="Tartózkodás"
              size="md"
              tone="strong"
              value={
                derived.nights === null ? "—" : `${derived.nights} éjszaka`
              }
            />
          </div>
        </Section>

        <Section
          icon={<AirplaneTakeoffIcon aria-hidden="true" />}
          title="Repülőjárat"
        >
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-[5.5rem_5.5rem_minmax(0,1fr)_11rem_8rem]">
            <AirportField
              label="Honnan"
              onChange={(value) => patchFlight({ originCode: value })}
              value={draft.flight.originCode}
            />
            <AirportField
              label="Hová"
              onChange={(value) => patchFlight({ destinationCode: value })}
              placeholder="VIE"
              value={draft.flight.destinationCode}
            />
            <Field label="Légitársaság">
              {({ id }) => (
                <Input
                  autoComplete="off"
                  id={id}
                  onChange={(event) =>
                    patchFlight({ carrier: event.target.value })
                  }
                  placeholder="Wizz Air"
                  value={draft.flight.carrier}
                />
              )}
            </Field>
            <MoneyField
              hint="Oda-vissza, egy főre"
              label="Repülő / fő"
              onChange={(value) => patchFlight({ pricePerPerson: value })}
              value={draft.flight.pricePerPerson}
            />
            {/* The multiplication shown next to the field it comes from, so
                the head count's effect on the total is never a surprise. */}
            <Readout
              className="self-start pt-[1.375rem]"
              label={`Összesen (${people} fő)`}
              size="md"
              tone="strong"
              value={formatHuf(derived.flightTotal || null)}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <LegFields
              arriveValue={draft.flight.outboundArrive}
              departValue={draft.flight.outboundDepart}
              fallbackDateIso={draft.arrival}
              from={draft.flight.originCode}
              minutes={outboundMinutes}
              onArriveChange={(value) => patchFlight({ outboundArrive: value })}
              onDepartChange={(value) => patchFlight({ outboundDepart: value })}
              title="Odaút"
              to={draft.flight.destinationCode}
            />
            <LegFields
              arriveValue={draft.flight.returnArrive}
              departValue={draft.flight.returnDepart}
              fallbackDateIso={draft.departure}
              from={draft.flight.destinationCode}
              minutes={returnMinutes}
              onArriveChange={(value) => patchFlight({ returnArrive: value })}
              onDepartChange={(value) => patchFlight({ returnDepart: value })}
              title="Visszaút"
              to={draft.flight.originCode}
            />
          </div>

          <Field className="max-w-2xl" label="Foglalási link (nem kötelező)">
            {({ id }) => (
              <Input
                autoComplete="off"
                id={id}
                onChange={(event) =>
                  patchFlight({ bookingUrl: event.target.value })
                }
                placeholder="https://wizzair.com/…"
                spellCheck={false}
                type="url"
                value={draft.flight.bookingUrl}
              />
            )}
          </Field>
        </Section>

        <Section title="Szállások">
          <HotelDrafts
            chosenHotelId={draft.chosenHotelId}
            hotels={draft.hotels}
            nights={derived.nights}
            onAdd={(hotel) =>
              setDraft((current) => ({
                ...current,
                hotels: [...current.hotels, hotel],
                // The first hotel added becomes the one that counts, so a
                // single-hotel destination needs no extra click.
                chosenHotelId: current.chosenHotelId ?? hotel.id,
              }))
            }
            onChoose={(id) => patch({ chosenHotelId: id })}
            onPatch={(id, hotelPatch) =>
              setDraft((current) => ({
                ...current,
                hotels: current.hotels.map((h) =>
                  h.id === id ? ({ ...h, ...hotelPatch } as Hotel) : h,
                ),
              }))
            }
            onRemove={(id) =>
              setDraft((current) => {
                const hotels = current.hotels.filter((h) => h.id !== id);
                return {
                  ...current,
                  hotels,
                  chosenHotelId:
                    current.chosenHotelId === id
                      ? (hotels[0]?.id ?? null)
                      : current.chosenHotelId,
                };
              })
            }
          />
        </Section>

        <Section title="Jegyzetek">
          <Field className="max-w-3xl" label="Bármi, amit érdemes megjegyezni">
            {({ id }) => (
              <textarea
                className="min-h-16 w-full resize-y border border-input bg-transparent px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
                id={id}
                onChange={(event) => patch({ notes: event.target.value })}
                placeholder="A reptéri transzfer 40 perc. Nézd meg, milyen messze a strand."
                value={draft.notes}
              />
            )}
          </Field>
        </Section>
      </div>

      <FormFooter
        derived={derived}
        editing={Boolean(editing)}
        onCancel={onCancel}
        people={people}
      />
    </form>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function LegFields({
  title,
  from,
  to,
  departValue,
  arriveValue,
  onDepartChange,
  onArriveChange,
  fallbackDateIso,
  minutes,
}: {
  title: string;
  from: string;
  to: string;
  departValue: string;
  arriveValue: string;
  onDepartChange: (value: string) => void;
  onArriveChange: (value: string) => void;
  fallbackDateIso: string;
  minutes: number | null;
}) {
  const route = from && to ? `${from} → ${to}` : "";
  // A landing defaults to the same day it took off on, which is right for
  // every short-haul flight and one click away from right for the rest.
  const arrivalFallback = splitDateTime(departValue).date || fallbackDateIso;

  return (
    <div className="flex flex-col gap-2.5 border border-border p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-foreground">
          {title}
        </span>
        {route ? (
          <span className="numeric text-[0.6875rem] text-muted-foreground">
            {route}
          </span>
        ) : null}
      </div>
      <DateTimeField
        fallbackDateIso={fallbackDateIso}
        label="Felszállás"
        onChange={onDepartChange}
        value={departValue}
      />
      <DateTimeField
        fallbackDateIso={arrivalFallback}
        label="Leszállás"
        minDateIso={splitDateTime(departValue).date || undefined}
        onChange={onArriveChange}
        value={arriveValue}
      />
      <p className="text-[0.6875rem] text-muted-foreground">
        {minutes === null ? (
          "Az időtartam mindkét időpont megadása után jelenik meg"
        ) : (
          <>
            <span className="numeric text-foreground">
              {formatDuration(minutes)}
            </span>{" "}
            a levegőben
          </>
        )}
      </p>
    </div>
  );
}

function FormFooter({
  derived,
  people,
  editing,
  onCancel,
}: {
  derived: ReturnType<typeof derive>;
  people: number;
  editing: boolean;
  onCancel: () => void;
}) {
  // With nothing priced yet, a derived "0 Ft" looks like a real answer. Every
  // other figure renders an em dash in that state; this one should match.
  const hasTotal = derived.tripTotal > 0;

  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-border border-t bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:items-end sm:justify-between">
      <dl className="flex flex-wrap items-end gap-x-5 gap-y-2">
        {/* The breakdown is useful on a laptop and overwhelming on a phone,
            where this footer would otherwise cover half the form. Only the two
            figures that drive the decision survive the small breakpoint. */}
        <FooterFigure
          className="hidden sm:flex"
          label="Repülő"
          value={formatHuf(derived.flightTotal || null)}
        />
        <FooterFigure
          className="hidden sm:flex"
          label="Szállás"
          value={formatHuf(derived.hotelTotal || null)}
        />
        <FooterFigure
          className="hidden sm:flex"
          label="Éjszakánként"
          value={formatHuf(derived.perNight)}
        />
        <FooterFigure
          label={`Fejenként (${people})`}
          value={formatHuf(hasTotal ? derived.perPerson : null)}
        />
        <FooterFigure
          emphasis
          label="Teljes költség"
          value={formatHuf(derived.tripTotal || null)}
        />
      </dl>
      <div className="flex shrink-0 gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          Mégse
        </Button>
        <Button type="submit">
          {editing ? "Mentés" : "Úti cél hozzáadása"}
        </Button>
      </div>
    </div>
  );
}

function FooterFigure({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <dt className="field-label">{label}</dt>
      <dd
        className={
          emphasis
            ? "numeric text-base leading-none font-medium text-secondary"
            : "numeric text-xs leading-none text-foreground"
        }
        data-numeric=""
      >
        {value}
      </dd>
    </div>
  );
}
