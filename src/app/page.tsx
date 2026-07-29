import { Planner } from "@/components/planner";
import { TripProvider } from "@/components/trip-store";

export default function Home() {
  return (
    <TripProvider>
      <Planner />
    </TripProvider>
  );
}
