"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { newId } from "@/lib/id";
import {
  emptyProfile,
  initialProfileStore,
  loadStore,
  saveStore,
} from "@/lib/storage";
import { type TransferProfile, uniqueProfileName } from "@/lib/transfer";
import type {
  Destination,
  Hotel,
  Profile,
  ProfileStore,
  TripState,
} from "@/lib/types";
import { DEFAULT_PROFILE_NAME } from "@/lib/types";

type Action =
  | { type: "hydrate"; store: ProfileStore }
  // Trip edits — always applied to the active profile.
  | { type: "setPeople"; people: number }
  | { type: "saveDestination"; destination: Destination }
  | { type: "removeDestination"; id: string }
  | { type: "chooseHotel"; destinationId: string; hotelId: string }
  | {
      type: "patchHotel";
      destinationId: string;
      hotelId: string;
      patch: Partial<Hotel>;
    }
  // Profile management.
  | { type: "switchProfile"; id: string }
  | { type: "createProfile"; name: string }
  | { type: "renameProfile"; id: string; name: string }
  | { type: "duplicateProfile"; id: string }
  | { type: "deleteProfile"; id: string }
  | { type: "importProfiles"; profiles: TransferProfile[] };

/** Applies a change to the active profile's trip and stamps it as touched. */
function updateActiveTrip(
  store: ProfileStore,
  update: (trip: TripState) => TripState,
): ProfileStore {
  return {
    ...store,
    profiles: store.profiles.map((profile) =>
      profile.id === store.activeProfileId
        ? { ...profile, trip: update(profile.trip), updatedAt: Date.now() }
        : profile,
    ),
  };
}

function reducer(store: ProfileStore, action: Action): ProfileStore {
  switch (action.type) {
    case "hydrate":
      return action.store;

    case "setPeople":
      return updateActiveTrip(store, (trip) => ({
        ...trip,
        people: Math.max(1, Math.min(20, Math.round(action.people))),
      }));

    case "saveDestination":
      return updateActiveTrip(store, (trip) => {
        const exists = trip.destinations.some(
          (d) => d.id === action.destination.id,
        );
        return {
          ...trip,
          destinations: exists
            ? trip.destinations.map((d) =>
                d.id === action.destination.id ? action.destination : d,
              )
            : [...trip.destinations, action.destination],
        };
      });

    case "removeDestination":
      return updateActiveTrip(store, (trip) => ({
        ...trip,
        destinations: trip.destinations.filter((d) => d.id !== action.id),
      }));

    case "chooseHotel":
      return updateActiveTrip(store, (trip) => ({
        ...trip,
        destinations: trip.destinations.map((d) =>
          d.id === action.destinationId
            ? { ...d, chosenHotelId: action.hotelId }
            : d,
        ),
      }));

    case "patchHotel":
      return updateActiveTrip(store, (trip) => ({
        ...trip,
        destinations: trip.destinations.map((d) =>
          d.id !== action.destinationId
            ? d
            : {
                ...d,
                hotels: d.hotels.map((h) =>
                  h.id === action.hotelId ? { ...h, ...action.patch } : h,
                ),
              },
        ),
      }));

    case "switchProfile":
      return store.profiles.some((p) => p.id === action.id)
        ? { ...store, activeProfileId: action.id }
        : store;

    case "createProfile": {
      const profile = emptyProfile(
        uniqueProfileName(
          action.name,
          store.profiles.map((p) => p.name),
        ),
      );
      return {
        ...store,
        profiles: [...store.profiles, profile],
        // Switching straight to it: creating a profile is always a prelude to
        // putting something in it.
        activeProfileId: profile.id,
      };
    }

    case "renameProfile": {
      const name = uniqueProfileName(
        action.name,
        store.profiles.filter((p) => p.id !== action.id).map((p) => p.name),
      );
      return {
        ...store,
        profiles: store.profiles.map((p) =>
          p.id === action.id ? { ...p, name, updatedAt: Date.now() } : p,
        ),
      };
    }

    case "duplicateProfile": {
      const source = store.profiles.find((p) => p.id === action.id);
      if (!source) return store;
      const now = Date.now();
      const copy: Profile = {
        id: newId(),
        name: uniqueProfileName(
          `${source.name} másolat`,
          store.profiles.map((p) => p.name),
        ),
        // Fresh ids throughout, so editing the copy can never reach back into
        // the original's destinations or hotels.
        trip: withFreshIds(source.trip),
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...store,
        profiles: [...store.profiles, copy],
        activeProfileId: copy.id,
      };
    }

    case "deleteProfile": {
      const remaining = store.profiles.filter((p) => p.id !== action.id);
      // Never leave the app with nothing to show; the last profile deleted
      // becomes a fresh empty one instead of an impossible state.
      if (remaining.length === 0) {
        const replacement = emptyProfile(DEFAULT_PROFILE_NAME);
        return {
          ...store,
          profiles: [replacement],
          activeProfileId: replacement.id,
        };
      }
      return {
        ...store,
        profiles: remaining,
        activeProfileId:
          store.activeProfileId === action.id
            ? remaining[0].id
            : store.activeProfileId,
      };
    }

    case "importProfiles": {
      const taken = store.profiles.map((p) => p.name);
      const now = Date.now();
      const added: Profile[] = action.profiles.map((incoming) => {
        const name = uniqueProfileName(incoming.name, taken);
        taken.push(name);
        return {
          id: newId(),
          name,
          trip: withFreshIds(incoming.trip),
          createdAt: now,
          updatedAt: now,
        };
      });
      if (added.length === 0) return store;
      return {
        ...store,
        // Importing only ever adds. Nothing already saved is overwritten, so a
        // paste into the wrong window is a tidy-up, not a loss.
        profiles: [...store.profiles, ...added],
        activeProfileId: added[0].id,
      };
    }
  }
}

/**
 * Re-keys a trip so a duplicated or imported copy shares no ids with anything
 * already in the store.
 */
function withFreshIds(trip: TripState): TripState {
  return {
    ...trip,
    destinations: trip.destinations.map((destination) => {
      const hotelIdMap = new Map(
        destination.hotels.map((h) => [h.id, newId()]),
      );
      return {
        ...destination,
        id: newId(),
        hotels: destination.hotels.map((h) => ({
          ...h,
          id: hotelIdMap.get(h.id) ?? newId(),
        })),
        chosenHotelId: destination.chosenHotelId
          ? (hotelIdMap.get(destination.chosenHotelId) ?? null)
          : null,
      };
    }),
  };
}

type TripStore = {
  store: ProfileStore;
  /** The active profile — never null; the store always holds at least one. */
  profile: Profile;
  /** Shorthand for the active profile's trip. */
  state: TripState;
  dispatch: React.Dispatch<Action>;
  /** False during the first client render, before localStorage has been read. */
  hydrated: boolean;
};

const TripContext = createContext<TripStore | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(reducer, null, initialProfileStore);
  const [hydrated, setHydrated] = useState(false);

  // Read once on mount rather than during render: the server has no
  // localStorage, so reading it lazily in useState would desync the markup.
  useEffect(() => {
    const stored = loadStore();
    if (stored) dispatch({ type: "hydrate", store: stored });
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Gate on `hydrated` so the default empty store never overwrites real
    // saved data in the gap between mount and the read above.
    if (!hydrated) return;
    saveStore(store);
  }, [store, hydrated]);

  const value = useMemo(() => {
    const profile =
      store.profiles.find((p) => p.id === store.activeProfileId) ??
      store.profiles[0];
    return { store, profile, state: profile.trip, dispatch, hydrated };
  }, [store, hydrated]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripStore {
  const context = useContext(TripContext);
  if (!context) throw new Error("useTrip must be used inside <TripProvider>");
  return context;
}
