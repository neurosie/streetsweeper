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
  const [guessedRoads, setGuessedRoads] = useState(new Set<string>());

  function onGuess(event: FormEvent) {
    event.preventDefault();
    const guessBox = (event.target as HTMLElement).querySelector("input")!;
    const guess = guessBox.value.toLowerCase();
    if (guess.trim().length === 0) {
      return;
    }
    const matchedRoads = data!.roads.features
      .filter((road) => road.properties.alternateNames.includes(guess))
      .map((road) => road.properties.id);
    if (matchedRoads.length > 0) {
      setGuessedRoads(
        (guessedRoads) => new Set([...guessedRoads, ...matchedRoads]),
      );
    }
    guessBox.value = "";
  }

  let body;
  if (status === "loading") {
    body = <div className="self-center">Loading...</div>;
  } else if (status === "error") {
    body = <div>Error: {error.toString()}</div>;
  } else {
    const guessedLength = data.roads.features.reduce(
      (sum, road) =>
        sum +
        (guessedRoads.has(road.properties.id) ? road.properties.lengthMi : 0),
      0,
    );
    const totalLength = data.place.properties.totalLengthMi;

    body = (
      <>
        <form onSubmit={onGuess} className="mx-8 flex">
          <input className="flex-1 rounded p-2"></input>
          <button
            className="ml-4 rounded bg-gray-700 px-4 py-2 text-white"
            type="submit"
          >
            ✓
          </button>
        </form>

        <MapboxMap place={data} guessedRoads={guessedRoads} />

        <div className="mx-8 h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-cyan-500"
            style={{ width: `${(guessedLength / totalLength) * 100}%` }}
          ></div>
        </div>
        <div className="mx-8">
          {guessedLength.toFixed(1)} mi/{totalLength.toFixed(1)} mi
        </div>
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col items-stretch justify-center gap-4 bg-gradient-to-b from-pink-500 to-stone-400">
        {body}
      </main>
    </>
  );
}
