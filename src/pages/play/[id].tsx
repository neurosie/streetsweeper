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
    // >({ guess: "fake street", state: "wrong", newMatches: 0 });
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
    const totalLength = data.place.properties.totalLengthMi;
    const lengthLabel = `${guessedLength.toFixed(1)} mi/${totalLength.toFixed(
      1,
    )} mi`;
    // This doesn't work on narrow viewports, will need to revisit
    const showLengthOnBar = guessedLength / totalLength > 0.3;

    return (
      <div className="grid h-screen auto-rows-min sm:grid-cols-[1fr_2fr] sm:grid-rows-[auto_auto_1fr]">
        <form
          onSubmit={onGuess}
          className="col-start-1 col-end-1 mx-8 my-4 flex"
        >
          <input className="flex-1 rounded p-2"></input>
          <button
            className="ml-4 rounded bg-gray-700 px-4 py-2 text-white"
            type="submit"
          >
            Guess
          </button>
        </form>

        <div
          className="col-start-1 col-end-1 overflow-hidden transition-[max-height] duration-300"
          style={{
            /* 300 is an arbitrary value to force animation */
            maxHeight: lastGuess ? 300 : 0,
          }}
        >
          {lastGuess ? (
            <div
              className={
                "mx-8 rounded bg-amber-100 px-2 py-1 transition-[background-color] duration-[50ms]"
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

        <div className="relative h-[400px] w-full sm:col-start-2 sm:col-end-3 sm:row-span-full sm:h-full">
          <MapboxMap
            className="h-full w-full"
            place={data}
            guessedRoads={guessedRoads}
          />

          <div className="absolute bottom-10 w-full">
            <div className="z-10 mx-8 flex h-6 items-center rounded-full bg-white drop-shadow-lg">
              <div
                className="bg-royalblue-500 flex h-full items-center rounded-full transition-[width] duration-500"
                style={{ width: `${(guessedLength / totalLength) * 100}%` }}
              >
                {showLengthOnBar && (
                  <div className="mx-auto text-sm text-white">
                    {lengthLabel}
                  </div>
                )}
              </div>
              {!showLengthOnBar && (
                <div className="mx-auto text-sm">{lengthLabel}</div>
              )}
            </div>
            {/* <div className="mx-8">
            {guessedLength.toFixed(1)} mi/{totalLength.toFixed(1)} mi
          </div> */}
          </div>
        </div>
      </div>
    );
  }
}
