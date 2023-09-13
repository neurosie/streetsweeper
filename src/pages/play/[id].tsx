import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import MapboxMap from "~/components/MapboxMap";
import { api } from "~/utils/api";

export default function Play() {
  const router = useRouter();
  const placeId = router.query.id as string | undefined;
  const { status, data, error } = api.place.getById.useQuery(
    { id: placeId as string },
    { enabled: !!placeId },
  );
  const [guessedRoads, setGuessedRoads] = useState(new Set<number>());

  function onGuess(event: FormEvent) {
    event.preventDefault();
    const guessBox = (event.target as HTMLElement).querySelector("input")!;
    const guess = guessBox.value.toLowerCase();
    if (guess.trim().length === 0) {
      return;
    }
    const matchedRoads = data!.roads
      .filter((road) => road.alternateNames.includes(guess))
      .map((road) => road.id);
    if (matchedRoads.length > 0) {
      setGuessedRoads(
        (guessedRoads) => new Set([...guessedRoads, ...matchedRoads]),
      );
    }
    guessBox.value = "";
  }

  let body;
  if (status === "loading") {
    body = <div>Loading...</div>;
  } else if (status === "error") {
    body = <div>Error: {error.toString()}</div>;
  } else {
    body = (
      <>
        <MapboxMap place={data} guessedRoads={guessedRoads} />

        <form onSubmit={onGuess} className="m-8 flex">
          <input className="rounded p-2"></input>
          <button
            className="ml-4 rounded bg-gray-700 px-4 py-2 text-white"
            type="submit"
          >
            ✓
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-500 to-stone-400">
        {body}
      </main>
    </>
  );
}
