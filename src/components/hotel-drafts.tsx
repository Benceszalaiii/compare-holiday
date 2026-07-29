"use client";

import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  BuildingsIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useCallback, useId, useRef, useState } from "react";
import type { OgResponse } from "@/app/api/og/route";
import { MoneyField } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDelta, formatHuf, hostLabel } from "@/lib/format";
import { newId } from "@/lib/id";
import { emptyMeta, type Hotel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function newHotel(url: string): Hotel {
  return {
    id: newId(),
    url,
    totalPrice: 0,
    meta: emptyMeta(),
    fetchState: "loading",
    fetchNote: "",
  };
}

export function hotelName(hotel: Hotel): string {
  return hotel.meta.title ?? "";
}

export function hotelNameOrHost(hotel: Hotel): string {
  const name = hotelName(hotel);
  if (name) return name;
  return hotel.url ? hostLabel(hotel.url) : "Névtelen szállás";
}

type Props = {
  hotels: Hotel[];
  chosenHotelId: string | null;
  nights: number | null;
  onAdd: (hotel: Hotel) => void;
  onPatch: (id: string, patch: Partial<Hotel>) => void;
  onRemove: (id: string) => void;
  onChoose: (id: string) => void;
};

export function HotelDrafts({
  hotels,
  chosenHotelId,
  nights,
  onAdd,
  onPatch,
  onRemove,
  onChoose,
}: Props) {
  const [url, setUrl] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const groupName = useId();
  const urlFieldId = useId();

  const runFetch = useCallback(
    async (id: string, target: string) => {
      onPatch(id, { fetchState: "loading" });
      try {
        const response = await fetch(
          `/api/og?url=${encodeURIComponent(target)}`,
        );
        const data: OgResponse = await response.json();
        if (data.ok) {
          onPatch(id, { meta: data.meta, fetchState: "ok", fetchNote: "" });
        } else {
          // Keep whatever the server worked out from the URL: a name guessed
          // from the slug is a much better starting point than a blank field.
          onPatch(id, {
            meta: data.fallback ?? emptyMeta(),
            fetchState: "failed",
            fetchNote: data.reason,
          });
        }
      } catch {
        onPatch(id, {
          meta: emptyMeta(),
          fetchState: "failed",
          fetchNote: "Nem sikerült elérni a linket.",
        });
      }
    },
    [onPatch],
  );

  function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) {
      setAddError("Előbb illessz be egy Booking-, Airbnb- vagy szálláslinket.");
      urlInputRef.current?.focus();
      return;
    }
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    if (hotels.some((h) => h.url === withProtocol)) {
      setAddError("Ez a szállás már szerepel a listán.");
      return;
    }
    const hotel = newHotel(withProtocol);
    onAdd(hotel);
    setUrl("");
    setAddError(null);
    void runFetch(hotel.id, withProtocol);
    urlInputRef.current?.focus();
  }

  const chosen =
    hotels.find((h) => h.id === chosenHotelId) ?? hotels[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-w-3xl flex-col gap-1.5">
        <label className="field-label" htmlFor={urlFieldId}>
          Illessz be egy szállás-linket
        </label>
        <div className="flex gap-1.5">
          <Input
            aria-describedby={
              addError ? `${urlFieldId}-error` : `${urlFieldId}-hint`
            }
            aria-invalid={addError ? true : undefined}
            autoComplete="off"
            id={urlFieldId}
            onChange={(event) => {
              setUrl(event.target.value);
              if (addError) setAddError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Adding a hotel must not submit the whole destination form.
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder="https://www.booking.com/hotel/at/…"
            ref={urlInputRef}
            spellCheck={false}
            type="url"
            value={url}
          />
          <Button
            onClick={handleAdd}
            size="default"
            type="button"
            variant="outline"
          >
            <PlusIcon
              aria-hidden="true"
              data-icon="inline-start"
              weight="bold"
            />
            Hozzáad
          </Button>
        </div>
        {addError ? (
          <p
            className="text-[0.6875rem] text-destructive"
            id={`${urlFieldId}-error`}
          >
            {addError}
          </p>
        ) : (
          <p
            className="text-[0.6875rem] text-muted-foreground"
            id={`${urlFieldId}-hint`}
          >
            A nevet, a képet és a helyet az oldalról olvasom ki.
          </p>
        )}
      </div>

      {hotels.length === 0 ? (
        <p className="border border-border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Még nincs szállás. Vegyél fel annyit, amennyit mérlegelsz — te döntöd
          el, melyik számít bele a végösszegbe.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hotels.map((hotel) => (
            <HotelDraftRow
              chosen={chosen}
              groupName={groupName}
              hotel={hotel}
              key={hotel.id}
              nights={nights}
              onChoose={onChoose}
              onPatch={onPatch}
              onRemove={onRemove}
              onRetry={() => void runFetch(hotel.id, hotel.url)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function HotelDraftRow({
  hotel,
  chosen,
  nights,
  groupName,
  onPatch,
  onRemove,
  onChoose,
  onRetry,
}: {
  hotel: Hotel;
  chosen: Hotel | null;
  nights: number | null;
  groupName: string;
  onPatch: (id: string, patch: Partial<Hotel>) => void;
  onRemove: (id: string) => void;
  onChoose: (id: string) => void;
  onRetry: () => void;
}) {
  const isChosen = chosen?.id === hotel.id;
  const loading = hotel.fetchState === "loading";
  const failed = hotel.fetchState === "failed";
  const perNight =
    nights && nights > 0 && hotel.totalPrice > 0
      ? hotel.totalPrice / nights
      : null;
  const delta =
    chosen &&
    chosen.id !== hotel.id &&
    hotel.totalPrice > 0 &&
    chosen.totalPrice > 0
      ? hotel.totalPrice - chosen.totalPrice
      : null;

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border border-border bg-card/40 p-2 transition-colors",
        "sm:grid-cols-[auto_5.5rem_minmax(0,1fr)_10rem]",
        isChosen && "border-secondary/50 bg-secondary/5",
      )}
    >
      <input
        aria-label={`${hotelNameOrHost(hotel)} beszámítása a végösszegbe`}
        checked={isChosen}
        className="mt-1.5 size-3.5 accent-secondary"
        name={groupName}
        onChange={() => onChoose(hotel.id)}
        type="radio"
      />

      <HotelThumb hotel={hotel} loading={loading} />

      <div className="flex min-w-0 flex-col gap-1">
        {loading ? (
          <>
            <span className="h-3 w-2/3 animate-pulse bg-muted-foreground/20" />
            <span className="h-2.5 w-1/2 animate-pulse bg-muted-foreground/10" />
          </>
        ) : failed ? (
          <>
            <p className="flex items-start gap-1.5 text-[0.6875rem] leading-tight text-muted-foreground">
              <WarningCircleIcon
                aria-hidden="true"
                className="mt-px shrink-0 text-destructive"
                weight="fill"
              />
              <span>
                {hotel.fetchNote || "Nem sikerült beolvasni az oldalt."}{" "}
                {hotel.meta.title
                  ? "A nevet a linkből tippeltem — javítsd, ha kell."
                  : "Írd be az adatokat kézzel."}
              </span>
            </p>
            <Input
              aria-label="Szállás neve"
              className="h-7"
              onChange={(event) =>
                onPatch(hotel.id, {
                  meta: { ...hotel.meta, title: event.target.value || null },
                })
              }
              placeholder="Szállás neve"
              value={hotel.meta.title ?? ""}
            />
            <Input
              aria-label="Helyszín"
              className="h-7"
              onChange={(event) =>
                onPatch(hotel.id, {
                  meta: { ...hotel.meta, location: event.target.value || null },
                })
              }
              placeholder="Helyszín (pl. Bécs, Ausztria)"
              value={hotel.meta.location ?? ""}
            />
            <Input
              aria-label="Kép URL-je"
              className="h-7"
              onChange={(event) =>
                onPatch(hotel.id, {
                  meta: { ...hotel.meta, image: event.target.value || null },
                })
              }
              placeholder="Kép linkje (nem kötelező)"
              spellCheck={false}
              type="url"
              value={hotel.meta.image ?? ""}
            />
          </>
        ) : (
          <>
            <p className="truncate text-xs font-medium text-foreground">
              {hotelNameOrHost(hotel)}
            </p>
            {hotel.meta.location ? (
              <p className="truncate text-[0.6875rem] text-muted-foreground">
                {hotel.meta.location}
              </p>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
            href={hotel.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {hostLabel(hotel.url)}
            <ArrowSquareOutIcon aria-hidden="true" className="size-3" />
          </a>
          {failed ? (
            <Button onClick={onRetry} size="xs" type="button" variant="ghost">
              <ArrowClockwiseIcon aria-hidden="true" data-icon="inline-start" />
              Újra
            </Button>
          ) : null}
          <Button
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(hotel.id)}
            size="xs"
            type="button"
            variant="ghost"
          >
            <TrashIcon aria-hidden="true" data-icon="inline-start" />
            <span className="sr-only sm:not-sr-only">Törlés</span>
          </Button>
        </div>
      </div>

      <div className="col-span-3 flex flex-col gap-1 sm:col-span-1">
        <MoneyField
          label="Teljes tartózkodás"
          onChange={(value) => onPatch(hotel.id, { totalPrice: value })}
          value={hotel.totalPrice}
        />
        <p className="text-right text-[0.6875rem] text-muted-foreground">
          {perNight ? (
            <span className="numeric">{formatHuf(perNight)}/éj</span>
          ) : (
            "Add meg a dátumokat és az árat az éjszakai díjhoz"
          )}
          {delta !== null ? (
            <>
              {" · "}
              <span className="numeric">{formatDelta(delta)}</span> a
              választotthoz képest
            </>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function HotelThumb({ hotel, loading }: { hotel: Hotel; loading: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = hotel.meta.image;

  if (loading) {
    return (
      <div className="aspect-[4/3] w-full animate-pulse bg-muted-foreground/15" />
    );
  }

  if (!src || broken) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
        <BuildingsIcon aria-hidden="true" className="size-4" />
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: listing photos come from arbitrary third-party CDNs, which next/image would need a wildcard remotePatterns entry to allow.
    <img
      alt=""
      className="aspect-[4/3] w-full bg-muted object-cover"
      decoding="async"
      loading="lazy"
      onError={() => setBroken(true)}
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}
