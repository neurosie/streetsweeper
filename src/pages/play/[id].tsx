import Link from "next/link";
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
    { guess: string; state: GuessState; newMatchCount: number } | undefined
  >(undefined);
  const [finished, setFinished] = useState(false);

  /**
   * Load game from localStorage.
   * This needs to be in an effect because placeId is not available during prerendering.
   */
  useEffect(() => {
    if (!placeId || !data) return;
    const savedGame = localStorage.getItem(storageKey(placeId));
    if (savedGame) {
      const parsedSave: unknown = JSON.parse(savedGame);
      if (
        Array.isArray(parsedSave) &&
        parsedSave.length > 0 &&
        typeof parsedSave[0] === "string"
      ) {
        setGuessedRoads(
          data.roads.features.flatMap((road) =>
            parsedSave.includes(road.properties.id) ? [road.properties.id] : [],
          ),
        );
      }
    }
  }, [placeId, data]);

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
    let newMatchCount = 0;
    const matchedRoads = data!.roads.features
      .filter((road) => road.properties.alternateNames.includes(guess))
      .map((road) => road.properties.id);
    if (matchedRoads.length > 0) {
      const newlyMatchedRoads = matchedRoads.filter(
        (road) => !guessedRoads.includes(road),
      );
      newMatchCount = newlyMatchedRoads.length;
      if (newMatchCount === 0) {
        guessState = "repeat";
      } else {
        guessState = "right";
      }
      setGuessedRoads((guessedRoads) => guessedRoads.concat(newlyMatchedRoads));
    }
    setLastGuess({ guess, state: guessState, newMatchCount });
  }

  function playAgain() {
    setFinished(false);
    setGuessedRoads([]);
    setLastGuess(undefined);
    localStorage.setItem(storageKey(placeId!), JSON.stringify(Array.from([])));
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="sr-only">Loading...</div>
        <div className="relative flex h-32 w-32 items-baseline justify-center sm:h-48 sm:w-48">
          <div className="h-full w-full animate-[spin-reverse_20s_infinite] rounded-full border-2 border-dashed border-amber-300"></div>
          <div className="absolute bottom-16 mx-auto origin-bottom animate-[spin_4s_linear_infinite] pb-[50px] sm:bottom-24 sm:pb-[74px]">
            <div className="animate-car-bounce text-sign-500">{carIcon}</div>
          </div>
        </div>
      </div>
    );
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
        <header className="flex flex-col items-center gap-3 pt-3">
          <Link href="/">
            <h1 className="bg-sign-600 ring-sign-600 m-[6px] rounded-xl px-4 pb-1 pt-2 text-4xl font-semibold text-white ring-2 ring-offset-4 ring-offset-white drop-shadow-[-2px_2px_theme(colors.sign.700)]">
              StreetSweeper
            </h1>
          </Link>
          <hr
            role="presentation"
            className="h-2 w-full border-y-2 border-amber-300"
          />
        </header>
        {/* Main grid */}
        <main className="grid grow gap-x-3 gap-y-3 pt-1 sm:grid-cols-[1fr_2fr] sm:grid-rows-[auto_minmax(0,1fr)] sm:gap-x-4 sm:pl-3">
          {/* Guess box */}
          <div className="mx-4 mt-2 gap-4 sm:col-start-1 sm:col-end-1">
            <div className="m-[8px] flex flex-1 flex-col items-center justify-center gap-3 rounded-md bg-infosign-500 p-3 ring-4 ring-infosign-500 ring-offset-4 ring-offset-white drop-shadow-[-3px_4px_theme(colors.blue.900)]">
              <div className="flex flex-wrap items-baseline justify-center text-sm text-sky-100">
                <span className="inline-block whitespace-pre">
                  Welcome to {useThe ? "the " : ""}
                </span>
                <span className="inline-block">
                  <span className="font-cursive text-2xl sm:text-3xl">
                    {data.place.properties.name}
                  </span>
                  .
                </span>
              </div>
              {finished ? (
                <>
                  <div>
                    You guessed{" "}
                    <span className="font-bold">{guessedRoadsData.length}</span>{" "}
                    out of{" "}
                    <span className="font-bold">
                      {data.roads.features.length}
                    </span>{" "}
                    streets!
                  </div>
                  <button
                    className="relative bottom-[4px] rounded-lg bg-sign-400 p-2 font-semibold text-gray-900 drop-shadow-[0px_4px_theme(colors.sign.600)] active:bottom-0 active:drop-shadow-none"
                    onClick={playAgain}
                  >
                    Play again
                  </button>
                </>
              ) : (
                <>
                  <form onSubmit={onGuess} className="flex w-full gap-4">
                    <input
                      className="min-w-0 flex-1 rounded-lg border-2 border-gray-400 p-2 text-black"
                      placeholder="e.g. 'main st' or '1st'"
                    ></input>
                    <button
                      className="relative bottom-[4px] rounded-lg bg-gray-700 px-2 text-white drop-shadow-[0px_4px_theme(colors.gray.600)] active:bottom-0 active:drop-shadow-none"
                      onClick={() => setFinished(true)}
                      type="button"
                    >
                      Finish
                    </button>
                  </form>
                  <div className="text-sm text-sky-100">
                    {lastGuess ? (
                      <>
                        <span className="italic">
                          &ldquo;{lastGuess.guess}&rdquo;
                        </span>{" "}
                        :{" "}
                        {{
                          right: (x: number) =>
                            `+${x} road${x === 1 ? "" : "s"}!`,
                          wrong: () => "no roads",
                          repeat: () => "already guessed",
                        }[lastGuess.state](lastGuess.newMatchCount)}
                      </>
                    ) : (
                      <>&nbsp;</>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Map */}
          <div className="relative h-[400px] sm:col-start-2 sm:col-end-3 sm:row-start-1 sm:row-end-3 sm:h-full">
            <MapboxMap
              className="relative h-full"
              place={data}
              guessedRoads={guessedRoads}
              finished={finished}
            />
            {/* Score box */}
            <div className="bg-sign-600 ring-sign-600 absolute right-4 top-4 m-[3px] flex flex-col items-center self-stretch rounded-md px-0.5 py-2 shadow-stone-950 ring-1 ring-offset-2 ring-offset-white drop-shadow-[0_2px_theme(colors.sign.700)]">
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
            <div className="m-[8px] flex h-[calc(100%-16px)] flex-col rounded-md bg-white p-4 text-black shadow-stone-950 ring-4 ring-white ring-offset-4 ring-offset-black drop-shadow-[-3px_4px_theme(colors.gray.400)] sm:col-start-1 sm:col-end-1">
              <div className="mb-2 self-center text-xl font-bold uppercase">
                Guessed Streets
              </div>
              <ul className="list-disc overflow-y-auto pl-8 leading-relaxed text-gray-600">
                {guessedRoadsData.map((road) => (
                  <li key={road.properties.id}>
                    <span className="text-gray-900">
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

const carIcon = (
  <svg
    version="1.1"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="h-16 w-16 -scale-x-100 sm:h-24 sm:w-24"
    // xml:space="preserve"
  >
    <g>
      <path
        d="M495.144,222.319h-23.666l-57.053-99.424H202.691l-79.664,99.424H25.062
 c-15.469,0-27.236,13.815-24.722,29.086l15.072,91.822c0,0.726,0.594,1.388,1.322,1.388h64.387
 c3.305-28.757,27.764-51.166,57.379-51.166s54.076,22.409,57.381,51.166H343.43c3.305-28.757,27.766-51.166,57.381-51.166
 s54.074,22.409,57.381,51.166h36.953c9.32,0,16.856-7.537,16.856-16.858v-88.583C512,229.855,504.465,222.319,495.144,222.319z
  M327.894,162.559h57.906l35.898,59.76l1.254,3.709l0.268,0.984h-95.326V162.559z M179.853,226.923l1.879-4.604l47.799-59.76
 h53.016v64.454h-74.61L179.853,226.923z"
      />
      <path
        d="M138.5,313.282c-18.707,0-34.242,13.552-37.348,31.334c-0.398,2.114-0.598,4.362-0.598,6.611
 c0,20.889,16.99,37.878,37.945,37.878c20.957,0,37.946-16.99,37.946-37.878c0-2.248-0.198-4.496-0.594-6.611
 C172.744,326.833,157.209,313.282,138.5,313.282z"
      />
      <path
        d="M400.81,313.282c-18.709,0-34.244,13.552-37.35,31.334c-0.398,2.114-0.596,4.362-0.596,6.611
 c0,20.889,16.988,37.878,37.945,37.878c20.955,0,37.944-16.99,37.944-37.878c0-2.248-0.198-4.496-0.594-6.611
 C435.053,326.833,419.518,313.282,400.81,313.282z"
      />
    </g>
  </svg>
);
