import { useRouter } from "next/router";
import { type FormEvent, useState } from "react";
import MapboxMap from "~/components/MapboxMap";
import { api } from "~/utils/api";

type GuessState = "right" | "wrong" | "repeat";

export default function Play() {
  const router = useRouter();
  const placeId = router.query.id as string | undefined;
  const { status, data, error } = api.place.getById.useQuery(
    { id: placeId ?? "" },
    { enabled: !!placeId },
  );
  const [guessedRoads, setGuessedRoads] = useState(new Set<string>());
  const [lastGuess, setLastGuess] = useState<
    { guess: string; state: GuessState; newMatches: number } | undefined
  >(undefined);

  function onGuess(event: FormEvent) {
    event.preventDefault();
    const guessBox = (event.target as HTMLElement).querySelector("input")!;
    const guess = guessBox.value.toLowerCase();
    guessBox.value = "";
    if (guess.trim().length === 0) {
      return;
    }
    let guessState: GuessState = "wrong";
    let newMatches = 0;
    const matchedRoads = data!.roads.features
      .filter((road) => road.properties.alternateNames.includes(guess))
      .map((road) => road.properties.id);
    if (matchedRoads.length > 0) {
      newMatches = matchedRoads.filter(
        (road) => !guessedRoads.has(road),
      ).length;
      if (newMatches === 0) {
        guessState = "repeat";
      } else {
        guessState = "right";
      }
      setGuessedRoads(
        (guessedRoads) => new Set([...guessedRoads, ...matchedRoads]),
      );
    }
    setLastGuess({ guess, state: guessState, newMatches });
  }

  let body;
  if (status === "loading") {
    body = <div className="self-center">Loading...</div>;
  } else if (status === "error") {
    console.error(error);
    body = <div>Something went wrong :(</div>;
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
            Guess
          </button>
        </form>

        <div
          className="overflow-hidden transition-[max-height] duration-300"
          style={{
            /* 300 is an arbitrary value to force animation */
            maxHeight: lastGuess ? 300 : 0,
          }}
        >
          {lastGuess ? (
            <div
              className={
                "mx-8 rounded px-2 py-1 transition-[background-color] duration-[50ms] " +
                {
                  right: "bg-green-200",
                  wrong: "bg-red-100",
                  repeat: "bg-amber-100",
                }[lastGuess.state]
              }
            >
              <span className="italic">&ldquo;{lastGuess.guess}&rdquo;</span>:{" "}
              {{
                right: (x: number) => `+${x} roads!`,
                wrong: () => "0 roads",
                repeat: () => "already guessed",
              }[lastGuess.state](lastGuess.newMatches)}
            </div>
          ) : (
            ""
          )}
        </div>

        <MapboxMap place={data} guessedRoads={guessedRoads} />

        <div className="mx-8 h-2 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-cyan-500 transition-[width] duration-500"
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
      <main className="md: flex min-h-screen flex-col items-stretch justify-center gap-4 bg-gradient-to-b from-pink-500 to-stone-400 py-4 md:px-12">
        {body}
      </main>
    </>
  );
}
