import { useRouter } from "next/router";
import { type FormEvent, useState, useEffect } from "react";
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

  /**
   * Load game from localStorage.
   * This needs to be in an effect because placeId is not available during prerendering.
   */
  useEffect(() => {
    if (!placeId) return;
    const savedGame = localStorage.getItem(storageKey(placeId));
    if (savedGame) {
      const parsedSave = JSON.parse(savedGame) as string[];
      setGuessedRoads(new Set(parsedSave));
    }
  }, [placeId]);

  /**
   * Save game to localStorage.
   */
  useEffect(() => {
    if (!placeId || guessedRoads.size === 0) return;
    localStorage.setItem(
      storageKey(placeId),
      JSON.stringify(Array.from(guessedRoads)),
    );
  }, [placeId, guessedRoads]);

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

  if (status === "loading") {
    return <div className="self-center">Loading...</div>;
  } else if (status === "error") {
    console.error(error);
    return <div>Something went wrong :(</div>;
  } else {
    const guessedLength = data.roads.features.reduce(
      (sum, road) =>
        sum +
        (guessedRoads.has(road.properties.id) ? road.properties.lengthMi : 0),
      0,
    );

    const sortedGuesses = data.roads.features
      .filter((road) => guessedRoads.has(road.properties.id))
      .sort((a, b) => b.properties.lengthMi - a.properties.lengthMi);

    return (
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex flex-col items-center gap-4 pt-4">
          <h1 className="m-[6px] rounded-xl bg-sign-800 px-4 pb-1 pt-2 text-4xl font-semibold text-white ring-2 ring-sign-800 ring-offset-4 ring-offset-white ">
            StreetSweeper
          </h1>
          <hr
            role="presentation"
            className="h-2 w-full border-none bg-road-line from-yellow-300"
          />
        </header>
        {/* Main grid */}
        <main className="m-3 grid grow auto-rows-min gap-3 sm:m-4 sm:grid-cols-[1fr_2fr] sm:grid-rows-[auto_1fr] sm:gap-4">
          {/* Guess box */}
          <div className="flex items-start gap-4 sm:col-start-1 sm:col-end-1">
            <div className="m-[8px] flex flex-1 flex-col items-center justify-center gap-3 rounded-md bg-infosign-500 p-3 shadow-stone-950 ring-4 ring-infosign-500 ring-offset-4 ring-offset-white">
              <form onSubmit={onGuess} className="flex">
                <input className="flex-1 rounded p-2 text-black"></input>
                {/* <button
                  className="ml-4 rounded bg-gray-700 px-4 py-2 text-white"
                  type="submit"
                >
                  Guess
                </button> */}
              </form>
              {lastGuess ? (
                <div className="text-sm">
                  <span className="italic">
                    &ldquo;{lastGuess.guess}&rdquo;
                  </span>{" "}
                  :{" "}
                  {{
                    right: (x: number) => `+${x} road${x === 1 ? "" : "s"}!`,
                    wrong: () => "0 roads",
                    repeat: () => "already guessed",
                  }[lastGuess.state](lastGuess.newMatches)}
                </div>
              ) : (
                <div>&nbsp;</div>
              )}
            </div>
            {/* Score box */}
            <div className="m-[3px] flex flex-col items-center self-stretch rounded-md bg-sign-800 px-0.5 py-2 shadow-stone-950 ring-1 ring-sign-800 ring-offset-2 ring-offset-white">
              <div className="text-sm uppercase tracking-tighter">Miles</div>
              <div className="text-3xl font-bold leading-none">
                {Array.from(guessedLength.toFixed(0)).map((c, i) => (
                  <span className="block text-center" key={i}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="paper-shadow inset-0 h-[400px] sm:col-start-2 sm:col-end-3 sm:row-start-1 sm:row-end-3 sm:h-full">
            <div className="paper h-full bg-white p-2 sm:p-4">
              <MapboxMap
                className="relative h-full ring-1 ring-gray-600"
                place={data}
                guessedRoads={guessedRoads}
              />
            </div>
          </div>

          {/* Guess list */}
          <div className="m-[8px] flex flex-col overflow-y-auto rounded-md bg-white p-4 text-black shadow-stone-950 ring-4 ring-white ring-offset-4 ring-offset-black sm:col-start-1 sm:col-end-1">
            <div className="self-center text-xl font-bold uppercase">Roads</div>
            <ol>
              {sortedGuesses.map((road) => (
                <li key={road.properties.id}>
                  {road.properties.name}{" "}
                  <span className="font-light text-gray-600">
                    - {road.properties.lengthMi.toFixed(1)} mi
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </main>
      </div>
    );
  }
}

function storageKey(placeId: string) {
  return `game-${placeId}`;
}
