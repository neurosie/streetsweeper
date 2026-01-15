import { Dialog } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import assert from "assert";
import Link from "next/link";
import { useRouter } from "next/router";
import { type FormEvent, useState, useEffect, useCallback } from "react";
import { carIcon } from "~/components/carIcon";
import Map from "~/components/Map";
import { type PlaceResponse, type Road } from "~/server/geo/geojson";
import { api } from "~/utils/api";
import { generateAbbreviations } from "~/utils/abbreviations";

type GuessState = "right" | "wrong" | "repeat";

function expandAlternateNames(data: PlaceResponse): PlaceResponse {
  for (const road of data.roads.features) {
    road.properties.alternateNames = Array.from(
      new Set(
        road.properties.alternateNames.flatMap((name) =>
          generateAbbreviations(name, "easy"),
        ),
      ),
    );
  }
  return data;
}

export default function Play() {
  const router = useRouter();
  const placeId = router.query.id as string | undefined;

  // Data fetching
  const {
    data: placeDataUrl,
    status: apiStatus,
    error: apiError,
  } = api.place.getById.useQuery({ id: placeId ?? "" }, { enabled: !!placeId });
  const {
    data,
    status: dataStatus,
    error: dataError,
  } = useQuery<PlaceResponse, Error>({
    queryKey: ["place", placeId],
    enabled: !!placeDataUrl,
    queryFn: async () => {
      const response = await fetch(placeDataUrl!);
      if (!response.ok) {
        throw new Error("Data response had an error: " + response.statusText);
      }
      const data = (await response.json()) as PlaceResponse;
      return expandAlternateNames(data);
    },
  });
  let status: "apiLoading" | "dataLoading" | "error" | "success",
    errorMessage: string | undefined;
  if (apiStatus === "loading") {
    status = "apiLoading";
  } else if (apiStatus === "error") {
    status = "error";
    errorMessage = apiError.message;
  } else if (dataStatus === "loading") {
    status = "dataLoading";
  } else if (dataStatus === "error") {
    status = "error";
    errorMessage = dataError.message;
  } else {
    status = "success";
  }

  // State
  const [guessedRoads, setGuessedRoads] = useState<string[]>([]);
  const [lastGuess, setLastGuess] = useState<
    { guess: string; state: GuessState; newMatches: string[] } | undefined
  >(undefined);
  const [hasLoadedSave, setHasLoadedSave] = useState(false);
  const [isConfirmFinishDialogOpen, setIsConfirmFinishDialogOpen] =
    useState(false);
  const [finished, setFinished] = useState(false);
  const [viewMode, setViewMode] = useState<"guessing" | "reviewing">(
    "guessing",
  );

  // Save management
  const setSave = useCallback(
    (save: string[]) => {
      if (!placeId) return;
      localStorage.setItem(storageKey(placeId), JSON.stringify(save));
    },
    [placeId],
  );

  /**
   * Load game from localStorage.
   */
  if (placeId && data && !hasLoadedSave) {
    const savedGame = localStorage.getItem(storageKey(placeId));
    setHasLoadedSave(true);
    if (savedGame) {
      let maybeParsedSave: unknown;
      try {
        maybeParsedSave = JSON.parse(savedGame);
      } catch (_) {
        // Malformed save, clear it.
        setSave([]);
      }
      // Needs to be const for type inference below
      const parsedSave = maybeParsedSave;
      if (
        Array.isArray(parsedSave) &&
        parsedSave.length > 0 &&
        typeof parsedSave[0] === "string"
      ) {
        if (parsedSave[0].startsWith("way/")) {
          alert(
            "You have a saved game from an older version of StreetSweeper. It couldn't be loaded in the current version, my apologies. Thanks for being an OG fan!",
          );
          setSave([]);
        } else {
          setGuessedRoads(
            parsedSave.filter((name) =>
              data.roads.features.some((road) => road.properties.name === name),
            ),
          );
        }
      }
    }
  }

  /**
   * Save game to localStorage.
   */
  useEffect(() => {
    if (!placeId || guessedRoads.length === 0) return;
    setSave(Array.from(guessedRoads));
  }, [placeId, guessedRoads, setSave]);

  // Event handlers
  function onGuess(event: FormEvent) {
    event.preventDefault();
    const guessBox = (event.target as HTMLElement).querySelector("input")!;
    const guess = guessBox.value.toLowerCase().trim();
    guessBox.value = "";
    if (guess.trim().length === 0) {
      return;
    }
    let guessState: GuessState = "wrong";
    let newlyMatchedRoads: string[] = [];
    const matchedRoads = data!.roads.features
      .filter((road) => road.properties.alternateNames.includes(guess))
      .map((road) => road.properties.name);
    if (matchedRoads.length > 0) {
      newlyMatchedRoads = matchedRoads.filter(
        (road) => !guessedRoads.includes(road),
      );
      if (newlyMatchedRoads.length === 0) {
        guessState = "repeat";
      } else {
        guessState = "right";
        setGuessedRoads((guessedRoads) =>
          guessedRoads.concat(newlyMatchedRoads),
        );
      }
    }
    setLastGuess({ guess, state: guessState, newMatches: newlyMatchedRoads });
  }

  function playAgain() {
    setFinished(false);
    setGuessedRoads([]);
    setLastGuess(undefined);
    localStorage.setItem(storageKey(placeId!), JSON.stringify(Array.from([])));
  }

  // Rendering
  if (status === "apiLoading" || status === "dataLoading") {
    return (
      <div className="flex h-screen w-full flex-col gap-6">
        {Header}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="relative my-16 flex h-32 w-32 items-baseline justify-center sm:my-24 sm:h-48 sm:w-48">
            <div className="h-full w-full animate-[spin-reverse_20s_infinite] rounded-full border-2 border-dashed border-amber-300"></div>
            <div className="absolute bottom-16 mx-auto origin-bottom animate-[spin_4s_linear_infinite] pb-[50px] sm:bottom-24 sm:pb-[74px]">
              <div className="animate-car-bounce text-sign-500">{carIcon}</div>
            </div>
          </div>
          <div className="sm:text-lg">
            {status === "apiLoading"
              ? "Generating map..."
              : "Loading streets..."}
          </div>
        </div>
      </div>
    );
  } else if (status === "error") {
    return (
      <div className="flex h-screen flex-col items-center gap-6">
        {Header}
        <div className="m-[6px] w-[80%] rounded-xl bg-sign-600 p-4 text-white ring-2 ring-sign-600 ring-offset-4 ring-offset-white drop-shadow-[-2px_2px_theme(colors.sign.700)] sm:w-[600px]">
          <p>Something went wrong :(</p>
          <p className="font-mono">{errorMessage}</p>
        </div>
      </div>
    );
  } else {
    // Data fetching was successful, data is guaranteed to be defined
    assert(data);

    const useThe = data.place.properties.name.split(" ")[1] === "of";
    const guessedLength = data.roads.features.reduce(
      (sum, road) =>
        sum +
        (guessedRoads.includes(road.properties.name)
          ? road.properties.lengthMi
          : 0),
      0,
    );
    const guessedRoadsData = guessedRoads
      .toReversed()
      .map((roadId) =>
        data.roads.features.find((road) => road.properties.name === roadId),
      )
      .filter((road): road is Road => road !== null);
    return (
      <div className="flex h-screen flex-col sm:max-h-screen sm:min-h-screen">
        {/* Header */}
        {Header}

        {/* Mobile layout: flexbox column */}
        <div className="flex min-h-0 flex-1 flex-col sm:hidden">
          {/* Map - fills remaining space */}
          <div className="relative flex-1">
            <Map
              className="relative h-full text-black"
              place={data}
              guessedRoads={guessedRoads}
              finished={finished}
              newMatches={lastGuess?.newMatches ?? []}
            />
            {/* Streets counter button */}
            <button
              onClick={() =>
                setViewMode(viewMode === "guessing" ? "reviewing" : "guessing")
              }
              className="absolute right-2 top-2 m-[2px] flex flex-col items-center rounded-md bg-sign-600 px-2 py-1.5 text-white ring-1 ring-sign-600 ring-offset-2 ring-offset-white drop-shadow-[0_3px_theme(colors.sign.700)] active:translate-y-[2px] active:drop-shadow-none motion-safe:transition-transform"
            >
              <div className="text-xs uppercase tracking-tighter">Streets</div>
              <div className="text-2xl font-bold leading-none">
                {guessedRoadsData.length}
              </div>
              <div className="mt-0.5 text-[10px] text-gray-300">
                {viewMode === "guessing" ? "▼" : "▲"} View
              </div>
            </button>
          </div>

          {/* Fixed bottom input bar - always visible */}
          <div className="shrink-0 pb-2 pl-1 pt-2">
            {finished ? (
              <div className="mx-2 flex flex-col items-center gap-2 rounded-lg bg-infosign-500 px-3 py-2.5 text-center text-sm text-white ring-2 ring-infosign-500 ring-offset-2 ring-offset-white drop-shadow-[-2px_3px_theme(colors.blue.900)]">
                <div>
                  You guessed{" "}
                  <span className="font-bold">{guessedRoadsData.length}</span> /{" "}
                  <span className="font-bold">
                    {data.roads.features.length}
                  </span>{" "}
                  streets!
                </div>
                <button
                  className="relative bottom-[3px] rounded-lg bg-sign-400 px-3 py-1.5 font-semibold text-gray-900 drop-shadow-[0px_3px_theme(colors.sign.500)] active:bottom-0 active:drop-shadow-none"
                  onClick={playAgain}
                >
                  Play again
                </button>
              </div>
            ) : (
              <div className="mx-2 rounded-lg bg-infosign-500 px-2 py-2 ring-2 ring-infosign-500 ring-offset-2 ring-offset-white drop-shadow-[-2px_3px_theme(colors.blue.900)]">
                <form onSubmit={onGuess} className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border-2 border-gray-400 px-2 py-1.5 text-sm text-black placeholder:text-gray-500"
                    placeholder="e.g. 'main st' or '1st'"
                    size={15}
                  ></input>
                  <button
                    type="submit"
                    className="relative bottom-[2px] rounded-md bg-sign-400 px-3 py-1.5 text-sm font-semibold text-gray-900 drop-shadow-[0px_4px_theme(colors.sign.500)] active:bottom-0 active:drop-shadow-none"
                  >
                    Guess
                  </button>
                </form>
                {/* Feedback row */}
                <div className="mt-1.5 min-h-[20px] text-center text-xs font-medium text-white">
                  {lastGuess ? (
                    <div>
                      {lastGuess.state === "right" && (
                        <span>
                          <span className="text-green-300">✓</span> &ldquo;
                          {lastGuess.guess}&rdquo; +
                          {lastGuess.newMatches.length} road
                          {lastGuess.newMatches.length === 1 ? "" : "s"}!
                        </span>
                      )}
                      {lastGuess.state === "wrong" && (
                        <span>
                          <span className="text-red-300">✗</span> &ldquo;
                          {lastGuess.guess}&rdquo; no match
                        </span>
                      )}
                      {lastGuess.state === "repeat" && (
                        <span>
                          <span className="text-yellow-300">↻</span> &ldquo;
                          {lastGuess.guess}&rdquo; already guessed
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>Enter a street name!</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom drawer - streets list */}
          <div
            className={`fixed inset-x-0 bottom-0 z-10 flex max-h-[60vh] flex-col rounded-t-lg bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.3)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${
              viewMode === "reviewing"
                ? "motion-safe:translate-y-0"
                : "motion-safe:translate-y-full"
            }`}
          >
            {/* Back button header */}
            <div className="flex shrink-0 items-center border-b border-gray-200 px-3 py-2">
              <button
                onClick={() => setViewMode("guessing")}
                className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 active:text-gray-600"
              >
                <span>←</span>
                <span>Back to Guessing</span>
              </button>
            </div>

            {/* Progress header */}
            <div className="shrink-0 border-b border-gray-200 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-900">
                {guessedRoadsData.length} / {data.roads.features.length} Streets
              </div>
            </div>

            {/* Streets list */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {guessedRoadsData.length > 0 ? (
                <ul className="space-y-2 pb-4">
                  {guessedRoadsData.map((road) => (
                    <li
                      key={road.properties.name}
                      className="flex items-baseline justify-between border-b border-gray-100 pb-2 last:border-b-0"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {road.properties.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {road.properties.lengthMi.toFixed(1)} mi
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-full items-center justify-center text-sm italic text-gray-500">
                  No streets yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop layout: grid */}
        <main className="hidden w-full max-w-[1800px] grow gap-x-2 gap-y-3 self-center pt-1 sm:grid sm:grid-cols-[1fr_2fr] sm:grid-rows-[auto_minmax(0,1fr)] sm:pl-3 md:gap-x-3">
          {/* Guess box */}
          <div className="mx-4 mt-2 gap-4 sm:col-start-1 sm:col-end-1 sm:mx-2 md:mx-4">
            <div className="m-[8px] flex flex-1 flex-col items-center justify-center gap-3 rounded-md bg-infosign-500 px-4 pb-2 pt-3 ring-4 ring-infosign-500 ring-offset-4 ring-offset-white drop-shadow-[-3px_4px_theme(colors.blue.900)]">
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
                    className="relative bottom-[4px] rounded-lg bg-sign-400 p-2 font-semibold text-gray-900 drop-shadow-[0px_4px_theme(colors.sign.500)] active:bottom-0 active:drop-shadow-none"
                    onClick={playAgain}
                  >
                    Play again
                  </button>
                </>
              ) : (
                <>
                  <form
                    onSubmit={onGuess}
                    className="flex w-full gap-4 sm:gap-3 lg:gap-4"
                  >
                    <input
                      className="min-w-0 flex-1 rounded-lg border-2 border-gray-400 p-2 text-black"
                      placeholder="e.g. 'main st' or '1st'"
                      size={15}
                    ></input>
                    <button
                      className="relative bottom-[4px] rounded-lg bg-gray-500 px-2 text-white drop-shadow-[0px_4px_theme(colors.gray.700)] active:bottom-0 active:drop-shadow-none"
                      onClick={() => setIsConfirmFinishDialogOpen(true)}
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
                        }[lastGuess.state](lastGuess.newMatches.length)}
                      </>
                    ) : (
                      <>Enter a street name!</>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Map */}
          <div className="relative h-[350px] sm:col-start-2 sm:col-end-3 sm:row-start-1 sm:row-end-3 sm:h-full">
            <Map
              className="relative h-full text-black"
              place={data}
              guessedRoads={guessedRoads}
              finished={finished}
              newMatches={lastGuess?.newMatches ?? []}
            />
            {/* Score box */}
            <div className="absolute right-4 top-4 m-[3px] flex flex-col items-center self-stretch rounded-md bg-sign-600 px-0.5 py-2 shadow-stone-950 ring-1 ring-sign-600 ring-offset-2 ring-offset-white drop-shadow-[0_2px_theme(colors.sign.700)]">
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
          <div className="mx-4 pb-4 sm:col-start-1 sm:col-end-1 sm:mx-2 sm:h-0 sm:min-h-[max(150px,100%)] md:mx-4">
            <div className="m-[8px] flex h-[calc(100%-16px)] flex-col rounded-md bg-white p-4 text-black shadow-stone-950 ring-4 ring-white ring-offset-4 ring-offset-black drop-shadow-[-3px_4px_theme(colors.gray.400)] sm:col-start-1 sm:col-end-1">
              <div className="mb-2 self-center text-xl font-bold uppercase">
                Guessed Streets
              </div>
              {guessedRoadsData.length > 0 ? (
                <ul className="list-disc overflow-y-auto pl-8 pr-2 leading-relaxed text-gray-600">
                  {guessedRoadsData.map((road) => (
                    <li key={road.properties.name}>
                      <span
                        className={
                          "text-gray-900" +
                          (lastGuess?.newMatches.includes(road.properties.name)
                            ? " [text-shadow:0_0_8px_theme(colors.warningsign.500)]"
                            : "")
                        }
                      >
                        {road.properties.name}
                      </span>{" "}
                      <span className="font-light text-gray-600">
                        - {road.properties.lengthMi.toFixed(1)} mi
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="self-center text-sm italic text-gray-600">
                  none yet
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Confirm finish dialog */}
        <Dialog open={isConfirmFinishDialogOpen} onClose={() => null}>
          <div
            className="pointer-events-none fixed inset-0 z-10 bg-black/50"
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 z-20 flex w-screen items-center justify-center p-4"
            onClick={() => setIsConfirmFinishDialogOpen(false)}
          >
            <Dialog.Panel className="m-[4px] flex w-full max-w-md flex-col items-center gap-4 rounded-lg bg-warningsign-500 p-4 font-sans text-gray-900 ring-2 ring-warningsign-500 ring-offset-2 ring-offset-gray-900 drop-shadow-[-3px_4px_theme(colors.amber.800)]">
              <p className="text-lg">Are you sure you&apos;re all done?</p>
              <div className="flex gap-6">
                <button
                  className="relative bottom-[4px] rounded-lg bg-gray-500 p-2 text-white drop-shadow-[0px_4px_theme(colors.gray.700)] active:bottom-0 active:drop-shadow-none"
                  onClick={() => setIsConfirmFinishDialogOpen(false)}
                  type="button"
                >
                  Keep playing
                </button>
                <button
                  className="relative bottom-[4px] rounded-lg bg-red-600 p-2 font-semibold text-gray-100 drop-shadow-[0px_4px_theme(colors.red.900)] active:bottom-0 active:drop-shadow-none"
                  onClick={() => {
                    setIsConfirmFinishDialogOpen(false);
                    setFinished(true);
                  }}
                  type="button"
                >
                  I&apos;m done
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>
    );
  }
}

const Header = (
  <header className="flex w-full shrink-0 items-center justify-center py-1.5 sm:flex-col sm:gap-3 sm:py-3">
    <Link href="/">
      <h1 className="m-[3px] rounded-lg bg-sign-600 px-3 pt-1 text-xl font-semibold text-white ring-1 ring-sign-600 ring-offset-2 ring-offset-white drop-shadow-[-1px_1px_theme(colors.sign.700)] sm:m-[6px] sm:rounded-xl sm:px-4 sm:pb-1 sm:pt-2 sm:text-4xl sm:ring-2 sm:ring-offset-4 sm:drop-shadow-[-2px_2px_theme(colors.sign.700)]">
        StreetSweeper
      </h1>
    </Link>
    <hr
      role="presentation"
      className="hidden h-2 w-full border-y-2 border-amber-300 sm:block"
    />
  </header>
);

function storageKey(placeId: string) {
  return `game-${placeId}`;
}
