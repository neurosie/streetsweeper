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
    const matchedRoads = data!.roads
      .filter((road) => road.properties.alternateNames.includes(guess))
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

        {/* <div>red = 1, blue = 2, green = 3</div> */}
        <div className="mx-8 h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-cyan-500"
            style={{ width: "50%" }}
          ></div>
        </div>
        {/* <label htmlFor="progress-bar">XXX/YYY miles</label> */}
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
