import { useRouter } from "next/router";
import { type FormEvent, useState, useEffect } from "react";
import MapboxMap from "~/components/MapboxMap";
import { type Road } from "~/server/geo/geojson";
import { api } from "~/utils/api";

type GuessState = "right" | "wrong" | "repeat";

export default function Play() {
  const router = useRouter();
  const placeId = router.query.id as string | undefined;
  const { status, data, error } = api.place.getById.useQuery(
    { id: placeId ?? "" },
    { enabled: !!placeId },
  );
  const [guessedRoads, setGuessedRoads] = useState<string[]>([]);
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
      const parsedSave: unknown = JSON.parse(savedGame);
      if (
        Array.isArray(parsedSave) &&
        parsedSave.length > 0 &&
        typeof parsedSave[0] === "string"
      ) {
        setGuessedRoads(parsedSave);
      }
    }
  }, [placeId]);

  /**
   * Save game to localStorage.
   */
  useEffect(() => {
    if (!placeId || guessedRoads.length === 0) return;
    localStorage.setItem(
      storageKey(placeId),
      JSON.stringify(Array.from(guessedRoads)),
    );
  }, [placeId, guessedRoads]);

  function onGuess(event: FormEvent) {
    event.preventDefault();
    const guessBox = (event.target as HTMLElement).querySelector("input")!;
    const guess = guessBox.value.toLowerCase().trim();
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
        (road) => !guessedRoads.includes(road),
      ).length;
      if (newMatches === 0) {
        guessState = "repeat";
      } else {
        guessState = "right";
      }
      setGuessedRoads((guessedRoads) => guessedRoads.concat(matchedRoads));
    }
    setLastGuess({ guess, state: guessState, newMatches });
  }

  if (status === "loading") {
    return <div className="self-center">Loading...</div>;
  } else if (status === "error") {
    console.error(error);
    return <div>Something went wrong :(</div>;
  } else {
    const useThe = data.place.properties.name.split(" ")[1] === "of";
    const guessedLength = data.roads.features.reduce(
      (sum, road) =>
        sum +
        (guessedRoads.includes(road.properties.id)
          ? road.properties.lengthMi
          : 0),
      0,
    );
    const guessedRoadsData = guessedRoads
      .toReversed()
      .map((roadId) =>
        data.roads.features.find((road) => road.properties.id === roadId),
      )
      .filter((road): road is Road => road !== null);

    return (
      <div className="flex min-h-screen flex-col sm:max-h-screen">
        {/* Header */}
        <header className="flex flex-col items-center gap-3 bg-neutral-900 pb-3 pt-3">
          <h1 className="m-[6px] rounded-xl bg-sign-800 px-4 pb-1 pt-2 text-4xl font-semibold text-white ring-2 ring-sign-800 ring-offset-4 ring-offset-white ">
            StreetSweeper
          </h1>
          <hr
            role="presentation"
            className="h-2 w-full border-y-2 border-amber-400"
          />
        </header>
        {/* Main grid */}
        <main className="grid grow gap-x-3 gap-y-3 bg-neutral-900 sm:grid-cols-[1fr_2fr] sm:grid-rows-[auto_minmax(0,1fr)] sm:gap-x-4 sm:pl-3">
          {/* Guess box */}
          <div className="mx-4 flex items-start gap-4 sm:col-start-1 sm:col-end-1">
            <div className="m-[8px] flex flex-1 flex-col items-center justify-center gap-3 rounded-md bg-infosign-500 p-3 ring-4 ring-infosign-500 ring-offset-4 ring-offset-white ">
              <div className="flex flex-wrap items-baseline justify-center text-sm text-sky-100">
                <span className="inline-block whitespace-pre">
                  Welcome to {useThe ? "the " : ""}
                </span>
                <span className="inline-block">
                  <span className="font-cursive text-2xl">
                    {data.place.properties.name}
                  </span>
                  .
                </span>
              </div>
              <form onSubmit={onGuess} className="flex">
                <input className="flex-1 p-2 text-black"></input>
                {/* <button
                  className="ml-4 rounded bg-gray-700 px-4 py-2 text-white"
                  type="submit"
                >
                  Guess
                </button> */}
              </form>
              <div className="text-sm text-sky-100">
                {lastGuess ? (
                  <>
                    <span className="italic">
                      &ldquo;{lastGuess.guess}&rdquo;
                    </span>{" "}
                    :{" "}
                    {{
                      right: (x: number) => `+${x} road${x === 1 ? "" : "s"}!`,
                      wrong: () => "no roads",
                      repeat: () => "already guessed",
                    }[lastGuess.state](lastGuess.newMatches)}
                  </>
                ) : (
                  <>&nbsp;</>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="relative h-[400px] sm:col-start-2 sm:col-end-3 sm:row-start-1 sm:row-end-3 sm:h-full">
            <MapboxMap
              className="relative h-full ring-1 ring-gray-600"
              place={data}
              guessedRoads={guessedRoads}
            />
            {/* Score box */}
            <div className="absolute right-4 top-4 m-[3px] flex flex-col items-center self-stretch rounded-md bg-sign-800 px-0.5 py-2 shadow-stone-950 ring-1 ring-sign-800 ring-offset-2 ring-offset-white">
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

          {/* Guess list */}
          <div className="mx-4 pb-4 sm:col-start-1 sm:col-end-1 sm:h-0 sm:min-h-full">
            <div className="m-[8px] flex h-[calc(100%-16px)] flex-col rounded-md bg-white p-4 text-black shadow-stone-950 ring-4 ring-white ring-offset-4 ring-offset-black sm:col-start-1 sm:col-end-1">
              <div className="mb-2 self-center text-xl font-bold uppercase">
                Guessed Streets
              </div>
              <ul className="ml-8 list-disc overflow-y-auto italic leading-relaxed text-gray-600">
                {guessedRoadsData.map((road) => (
                  <li key={road.properties.id}>
                    <span className="pl-1 not-italic text-gray-900">
                      {road.properties.name}{" "}
                      <span className="font-light text-gray-600">
                        - {road.properties.lengthMi.toFixed(1)} mi
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

function storageKey(placeId: string) {
  return `game-${placeId}`;
}
