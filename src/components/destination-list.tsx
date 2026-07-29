"use client";

import {
  AirplaneLandingIcon,
  AirplaneTakeoffIcon,
  ArrowSquareOutIcon,
  BuildingsIcon,
  CaretDownIcon,
  NotePencilIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { hotelNameOrHost } from "@/components/hotel-drafts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chosenHotel, type Derived, type RankedDestination } from "@/lib/calc";
import {
  formatDateRange,
  formatDelta,
  formatDuration,
  formatHuf,
  formatTime,
  hostLabel,
} from "@/lib/format";
import type { Destination, Hotel } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Badge text naming the missing half of the cost. */
const MISSING_LABEL: Record<Derived["missing"], string> = {
  none: "",
  hotel: "Szállás nélkül",
  flight: "Repülő nélkül",
  both: "Nincs ár",
};

/** Why this row sits out of the ranking. */
const PARTIAL_NOTE: Record<Derived["missing"], string> = {
  none: "",
  hotel: "csak repülő — nem összevethető",
  flight: "csak szállás — nem összevethető",
  both: "nem összevethető",
};

export function DestinationList({
  entries,
  people,
  onEdit,
  onRemove,
  onChooseHotel,
}: {
  entries: RankedDestination[];
  people: number;
  onEdit: (destination: Destination) => void;
  onRemove: (id: string) => void;
  onChooseHotel: (destinationId: string, hotelId: string) => void;
}) {
  return (
    <ul className="border-border border-t">
      {entries.map((entry) => (
        <DestinationRow
          entry={entry}
          key={entry.destination.id}
          onChooseHotel={onChooseHotel}
          onEdit={onEdit}
          onRemove={onRemove}
          people={people}
        />
      ))}
    </ul>
  );
}

function DestinationRow({
  entry,
  people,
  onEdit,
  onRemove,
  onChooseHotel,
}: {
  entry: RankedDestination;
  people: number;
  onEdit: (destination: Destination) => void;
  onRemove: (id: string) => void;
  onChooseHotel: (destinationId: string, hotelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { destination, derived, deltaFromCheapest, isCheapest } = entry;
  const hotel = chosenHotel(destination);
  const panelId = `${destination.id}-detail`;

  return (
    <li className="border-border border-b">
      <div
        className={cn(
          "group/row grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 py-3 transition-colors",
          "md:grid-cols-[minmax(0,1fr)_15rem_auto]",
          isCheapest && "bg-secondary/[0.06]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-medium text-foreground">
              {destination.place || "Névtelen"}
            </h3>
            {isCheapest ? (
              <Badge
                className="bg-secondary text-secondary-foreground"
                variant="default"
              >
                Legolcsóbb
              </Badge>
            ) : null}
            {/* Names exactly which half of the cost is absent, because
                "incomplete" doesn't tell the user what to go and look up. */}
            {derived.missing !== "none" ? (
              <Badge
                className="border-destructive/40 text-destructive"
                variant="outline"
              >
                {MISSING_LABEL[derived.missing]}
              </Badge>
            ) : null}
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="numeric text-foreground">
              {formatDateRange(destination.arrival, destination.departure)}
            </span>
            {derived.nights !== null ? (
              <span>
                <span className="numeric">{derived.nights}</span> éjszaka
              </span>
            ) : null}
            {destination.flight.destinationCode ? (
              <span className="numeric">
                {destination.flight.originCode} →{" "}
                {destination.flight.destinationCode}
              </span>
            ) : null}
            {hotel ? (
              <span className="truncate">{hotelNameOrHost(hotel)}</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col items-start gap-1 md:items-end">
          <span
            className={cn(
              "numeric text-lg leading-none font-medium tracking-tight",
              isCheapest && "text-secondary",
              // A partial total is dimmed so it doesn't read with the same
              // authority as a real one. The badge above carries the actual
              // meaning, so nothing here depends on noticing the colour.
              !derived.comparable && "text-muted-foreground",
              derived.comparable && !isCheapest && "text-foreground",
            )}
            data-numeric=""
          >
            {formatHuf(derived.tripTotal || null)}
          </span>
          <span className="text-[0.6875rem] text-muted-foreground">
            {derived.perPerson ? (
              <>
                <span className="numeric">{formatHuf(derived.perPerson)}</span>{" "}
                /fő
              </>
            ) : (
              "Még nincs ár"
            )}
          </span>
          {/* Every priced row gets a third line, including the cheapest —
              otherwise the winner's row is visibly shorter than the rest and
              the column reads as ragged rather than ranked. */}
          {derived.comparable ? (
            <span className="numeric whitespace-nowrap text-[0.6875rem] text-muted-foreground">
              {isCheapest
                ? "ez a legolcsóbb"
                : `${formatDelta(deltaFromCheapest)} a legolcsóbbhoz képest`}
            </span>
          ) : derived.priced ? (
            <span className="whitespace-nowrap text-[0.6875rem] text-muted-foreground">
              {PARTIAL_NOTE[derived.missing]}
            </span>
          ) : null}
        </div>

        <div className="col-start-2 row-start-1 flex items-center gap-0.5 md:col-start-3">
          <Button
            aria-controls={panelId}
            aria-expanded={open}
            // Three bare "Részletek" buttons sound identical in a screen
            // reader; the place name is what tells them apart.
            aria-label={`${destination.place || "Névtelen"} részletei`}
            onClick={() => setOpen((v) => !v)}
            size="sm"
            variant="ghost"
          >
            <CaretDownIcon
              aria-hidden="true"
              className={cn(
                "transition-transform duration-200 ease-[var(--ease-out-quart)]",
                open && "rotate-180",
              )}
              data-icon="inline-start"
            />
            {open ? "Kevesebb" : "Részletek"}
          </Button>
        </div>
      </div>

      {open ? (
        <div
          className="grid gap-5 border-border border-t bg-card/40 px-4 py-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
          id={panelId}
        >
          <div className="flex flex-col gap-4">
            <FlightDetail
              derived={derived}
              destination={destination}
              people={people}
            />
            <CostBreakdown derived={derived} people={people} />
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <BuildingsIcon
                aria-hidden="true"
                className="text-muted-foreground"
              />
              Szállások
              <span className="numeric text-muted-foreground">
                ({destination.hotels.length})
              </span>
            </h4>
            {destination.hotels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ehhez az úti célhoz még nincs mentett szállás.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {destination.hotels.map((h) => (
                  <HotelTile
                    chosen={hotel}
                    hotel={h}
                    key={h.id}
                    nights={derived.nights}
                    onChoose={() => onChooseHotel(destination.id, h.id)}
                  />
                ))}
              </ul>
            )}

            {destination.notes ? (
              <div className="flex flex-col gap-1 border-border border-t pt-3">
                <span className="field-label">Jegyzetek</span>
                <p className="max-w-[70ch] text-xs leading-relaxed text-foreground">
                  {destination.notes}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-border border-t pt-3">
              <Button
                onClick={() => onEdit(destination)}
                size="sm"
                variant="outline"
              >
                <NotePencilIcon aria-hidden="true" data-icon="inline-start" />
                Szerkesztés
              </Button>
              {confirmingDelete ? (
                <>
                  <span className="text-xs text-muted-foreground">
                    Biztosan törlöd?
                  </span>
                  <Button
                    onClick={() => onRemove(destination.id)}
                    size="sm"
                    variant="destructive"
                  >
                    Igen, törlöm
                  </Button>
                  <Button
                    onClick={() => setConfirmingDelete(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Mégse
                  </Button>
                </>
              ) : (
                <Button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  size="sm"
                  variant="ghost"
                >
                  <TrashIcon aria-hidden="true" data-icon="inline-start" />
                  Törlés
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FlightDetail({
  destination,
  derived,
  people,
}: {
  destination: Destination;
  derived: Derived;
  people: number;
}) {
  const { flight } = destination;
  const hasTimes = Boolean(flight.outboundDepart && flight.outboundArrive);

  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <AirplaneTakeoffIcon
          aria-hidden="true"
          className="text-muted-foreground"
        />
        Repülőjárat
        {flight.carrier ? (
          <span className="font-normal text-muted-foreground">
            · {flight.carrier}
          </span>
        ) : null}
      </h4>

      {hasTimes ? (
        <div className="flex flex-col divide-y divide-border border border-border">
          <Leg
            arrive={flight.outboundArrive}
            depart={flight.outboundDepart}
            from={flight.originCode}
            icon={<AirplaneTakeoffIcon aria-hidden="true" />}
            label="Oda"
            minutes={derived.outboundMinutes}
            to={flight.destinationCode}
          />
          {flight.returnDepart && flight.returnArrive ? (
            <Leg
              arrive={flight.returnArrive}
              depart={flight.returnDepart}
              from={flight.destinationCode}
              icon={<AirplaneLandingIcon aria-hidden="true" />}
              label="Vissza"
              minutes={derived.returnMinutes}
              to={flight.originCode}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nincs mentett menetrend.
        </p>
      )}

      {/* Written as the multiplication it is, typed figure first, so the
          total can be checked at a glance against the airline's own price. */}
      <p className="numeric text-xs text-muted-foreground">
        <span className="text-foreground">
          {formatHuf(derived.flightPerPerson)}
        </span>
        {" / fő × "}
        <span className="text-foreground">{people}</span>
        {" fő = "}
        <span className="text-foreground">
          {formatHuf(derived.flightTotal || null)}
        </span>
      </p>

      {flight.bookingUrl ? (
        <a
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
          href={flight.bookingUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          {hostLabel(flight.bookingUrl)}
          <ArrowSquareOutIcon aria-hidden="true" className="size-3" />
        </a>
      ) : null}
    </section>
  );
}

function Leg({
  label,
  icon,
  from,
  to,
  depart,
  arrive,
  minutes,
}: {
  label: string;
  icon: React.ReactNode;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  minutes: number | null;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <span className="numeric flex items-baseline gap-1.5 text-xs text-foreground">
        <span>{from || "—"}</span>
        <time dateTime={depart}>{formatTime(depart)}</time>
        <span aria-hidden="true" className="text-muted-foreground">
          →
        </span>
        <span>{to || "—"}</span>
        <time dateTime={arrive}>{formatTime(arrive)}</time>
      </span>
      <span className="numeric text-[0.6875rem] text-muted-foreground">
        {formatDuration(minutes)}
      </span>
    </div>
  );
}

function CostBreakdown({
  derived,
  people,
}: {
  derived: Derived;
  people: number;
}) {
  const rows: Array<{
    label: string;
    value: string;
    sub?: string;
    warn?: boolean;
  }> = [
    {
      label: "Repülőjárat",
      value: formatHuf(derived.flightTotal || null),
      sub: derived.hasFlightPrice
        ? `${formatHuf(derived.flightPerPerson)} / fő × ${people} fő`
        : "nincs megadva",
      warn: !derived.hasFlightPrice,
    },
    {
      label: "Szállás",
      value: formatHuf(derived.hotelTotal || null),
      sub: derived.hasHotelPrice
        ? derived.hotelPerNight
          ? `${formatHuf(derived.hotelPerNight)} / éj`
          : undefined
        : "nincs megadva",
      warn: !derived.hasHotelPrice,
    },
    {
      label: "Teljes költség",
      value: formatHuf(derived.tripTotal || null),
      // Spelling out that the sum is short of a whole trip, right where the
      // sum is read, rather than only on the collapsed row.
      sub: derived.comparable
        ? derived.perPerson
          ? `${formatHuf(derived.perPerson)} / fő`
          : undefined
        : "részleges — hiányzik egy tétel",
      warn: !derived.comparable,
    },
    {
      label: "Fő / nap",
      value: formatHuf(derived.perPersonPerDay),
      sub:
        derived.days !== null ? `${derived.days} nap, ${people} fő` : undefined,
    },
  ];

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-foreground">Költség</h4>
      <dl className="flex flex-col divide-y divide-border border border-border">
        {rows.map((row) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 px-2.5 py-2"
            key={row.label}
          >
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="flex flex-col items-end gap-0.5">
              <span
                className={cn(
                  "numeric text-xs",
                  row.warn ? "text-muted-foreground" : "text-foreground",
                )}
                data-numeric=""
              >
                {row.value}
              </span>
              {row.sub ? (
                <span
                  className={cn(
                    "numeric text-[0.6875rem]",
                    row.warn ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {row.sub}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function HotelTile({
  hotel,
  chosen,
  nights,
  onChoose,
}: {
  hotel: Hotel;
  chosen: Hotel | null;
  nights: number | null;
  onChoose: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const isChosen = chosen?.id === hotel.id;
  const perNight =
    nights && nights > 0 && hotel.totalPrice > 0
      ? hotel.totalPrice / nights
      : null;
  const delta =
    chosen && !isChosen && hotel.totalPrice > 0 && chosen.totalPrice > 0
      ? hotel.totalPrice - chosen.totalPrice
      : null;
  const src = broken ? null : hotel.meta.image;

  return (
    <li
      className={cn(
        "flex flex-col border border-border bg-background transition-colors",
        isChosen && "border-secondary/60 bg-secondary/[0.07]",
      )}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: listing photos come from arbitrary third-party CDNs, which next/image would need a wildcard remotePatterns entry to allow.
        <img
          alt=""
          className="aspect-[16/10] w-full bg-muted object-cover"
          decoding="async"
          loading="lazy"
          onError={() => setBroken(true)}
          referrerPolicy="no-referrer"
          src={hotel.meta.image ?? ""}
        />
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-muted-foreground">
          <BuildingsIcon aria-hidden="true" className="size-5" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-xs font-medium text-foreground">
            {hotelNameOrHost(hotel)}
          </p>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {hotel.meta.location ?? hostLabel(hotel.url)}
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <p className="numeric text-xs text-foreground" data-numeric="">
            {formatHuf(hotel.totalPrice || null)}
            {perNight ? (
              <span className="text-muted-foreground">
                {" · "}
                {formatHuf(perNight)}/éj
              </span>
            ) : null}
          </p>
          {delta !== null ? (
            <p className="numeric text-[0.6875rem] text-muted-foreground">
              {formatDelta(delta)} a választotthoz képest
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-border border-t pt-2">
          {isChosen ? (
            <span className="text-[0.6875rem] font-medium text-secondary">
              Ez számít bele
            </span>
          ) : (
            <Button onClick={onChoose} size="xs" variant="outline">
              Ezt választom
            </Button>
          )}
          <a
            aria-label={`${hotelNameOrHost(hotel)} megnyitása: ${hostLabel(hotel.url)}`}
            className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
            href={hotel.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {hostLabel(hotel.url)}
            <ArrowSquareOutIcon aria-hidden="true" className="size-3" />
          </a>
        </div>
      </div>
    </li>
  );
}
