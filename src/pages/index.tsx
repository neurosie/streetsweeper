import Head from "next/head";
import { type KeyboardEvent, useCallback, useEffect, useState } from "react";
import { type PlaceResult } from "~/server/api/routers/search";
import { api } from "~/utils/api";
import Link from "next/link";
import scrollIntoView from "scroll-into-view-if-needed";
import Loader from "~/components/Loader";

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  return (
    <>
      <Head>
        <title>StreetSweeper</title>
        <meta name="description" content="A local geography trivia game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* whole page */}
      <div className="flex flex-col items-center">
        {/* header */}
        <div className="flex w-full flex-col items-center gap-4 py-4 text-white sm:pt-8">
          <h1 className="bg-sign-600 ring-sign-600 mb-1 rounded-xl px-4 pb-1 pt-2 text-4xl font-semibold text-white shadow-md ring-2 ring-offset-4 ring-offset-white drop-shadow-[-2px_3px_theme(colors.sign.700)] sm:text-6xl">
            StreetSweeper
          </h1>
          <p className="italic">A local geography trivia game</p>
          <hr
            role="presentation"
            className="h-2 w-full border-none bg-road-line from-amber-300"
          />
        </div>
        {/* container for centering main content */}
        <div className="flex w-full flex-col items-center justify-around gap-8 px-4 py-8 sm:gap-12">
          {/* main content box */}
          <div className="flex w-full flex-col items-center justify-center gap-8 rounded-md bg-infosign-500 px-8 py-8 ring-4 ring-infosign-500 ring-offset-4 ring-offset-white drop-shadow-[-3px_5px_theme(colors.blue.900)] sm:w-[600px]">
            <p>
              Choose a city or town in the United States, and see how many
              streets you can name!
            </p>

            <PlaceSelector
              selectedPlace={selectedPlace}
              onSelectPlace={setSelectedPlace}
            />

            {selectedPlace && (
              <Link href={`play/${selectedPlace.osm_id}`}>
                <div className="relative m-[3px] rounded-lg bg-black p-1 text-black ring-2 ring-white drop-shadow-[-4px_6px_theme(colors.neutral.900)] active:-left-[4px] active:top-[6px] active:drop-shadow-none">
                  <div className="w-full">{oneWayPlay}</div>
                </div>
              </Link>
            )}
          </div>
        </div>
        <p className="mt-auto p-2 text-gray-300">
          Created by{" "}
          <Link
            className="font-semibold text-white underline underline-offset-2"
            href="https://github.com/neurosie"
          >
            Hayes Neuman
          </Link>
        </p>
      </div>
    </>
  );
}

function PlaceSelector({
  selectedPlace,
  onSelectPlace,
}: {
  selectedPlace: PlaceResult | null;
  onSelectPlace: (place: PlaceResult | null) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const searchboxId = "homepage-searchbox";

  function search() {
    const searchBox = document.getElementById(searchboxId) as HTMLInputElement;
    setSearchTerm(searchBox.value);
  }

  if (selectedPlace) {
    return (
      <div className="bg-infosign-800 flex w-full overflow-hidden rounded-lg border-2 border-gray-700">
        <PlaceCard place={selectedPlace} isStandalone={true}></PlaceCard>

        <button
          className="ml-auto px-4 py-4"
          onClick={() => onSelectPlace(null)}
          aria-label="Clear city selection"
        >
          {xIcon}
        </button>
      </div>
    );
  }

  return (
    <div className="sm:w-12/12 flex w-full flex-col gap-0">
      <div className="z-10 flex w-full cursor-default overflow-hidden rounded-t-lg border-2 border-gray-700 bg-gray-100 text-left text-gray-500 last:rounded-b-lg focus-within:bg-white focus-within:shadow-md focus-within:ring-2 focus-within:ring-black">
        <span className="relative bottom-[0.1em] my-auto pl-3 pr-2">
          {mapPinIcon}
        </span>
        <input
          id={searchboxId}
          className="w-full overflow-ellipsis border-none bg-inherit text-gray-900 outline-none placeholder:text-gray-500"
          onKeyDown={(event) => event.key === "Enter" && search()}
          placeholder="Search for a city or town"
          defaultValue={searchTerm}
        />
        <button className="px-4 py-4" onClick={search} aria-label="Search">
          {searchIcon}
        </button>
      </div>
      {!!searchTerm.length && (
        <SearchResults
          searchTerm={searchTerm}
          onSelectPlace={onSelectPlace}
        ></SearchResults>
      )}
    </div>
  );
}

function SearchResults({
  searchTerm,
  onSelectPlace,
}: {
  searchTerm: string;
  onSelectPlace: (place: PlaceResult | null) => void;
}) {
  const { status, data, error } = api.search.useQuery({
    query: searchTerm,
  });

  let content;
  if (status === "loading") {
    content = (
      <div className="m-4 flex justify-center">
        <div className="sr-only">Loading...</div>
        <Loader></Loader>
      </div>
    );
  } else if (status === "error") {
    console.error(error);
    content = (
      <div className="m-4 flex justify-center">
        Something went wrong fetching search results: {error.message}
      </div>
    );
  } else {
    const items = data.filter((entry) => entry.osm_type === "relation");
    if (items.length > 0) {
      content = (
        <>
          <SuggestionListBox
            items={items}
            key={searchTerm}
            onSelectPlace={onSelectPlace}
          ></SuggestionListBox>
          <div className="w-full p-1 text-center text-sm text-blue-100">
            Search data ©{" "}
            <a className="text-white underline" href="http://osm.org/copyright">
              OpenStreetMap
            </a>
            .
          </div>
        </>
      );
    } else {
      content = (
        <div className="m-4 flex justify-center">
          No results for &quot;{searchTerm}&quot;.
        </div>
      );
    }
  }
  return (
    <div className="bg-infosign-800 overflow-hidden rounded-b-2xl border-2 border-t-0 border-gray-700 text-white">
      {content}
    </div>
  );
}

// Assumes items is a non-empty list
function SuggestionListBox({
  items,
  onSelectPlace,
}: {
  items: PlaceResult[];
  onSelectPlace: (place: PlaceResult | null) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const id = useCallback(
    (index: number) => `option-${items[index]!.osm_id}`,
    [items],
  );

  /**
   * When the list box receives focus it'll auto scroll into view.
   * This is only needed if I give the listbox a max-height and make it scrollable,
   * so the specific active option scrolls into view.
   */
  function scrollActiveOptionIntoView() {
    const node = document.getElementById(id(activeIndex))!;
    scrollIntoView(node, { scrollMode: "if-needed" });
  }

  function keyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        if (event.key === "ArrowUp") {
          setActiveIndex(Math.max(activeIndex - 1, 0));
        } else {
          setActiveIndex(Math.min(activeIndex + 1, items.length - 1));
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelectPlace(items[activeIndex]!);
    }
  }

  useEffect(scrollActiveOptionIntoView, [activeIndex, id]);

  return (
    <ul
      role="listbox"
      tabIndex={0}
      aria-label="Search results"
      aria-activedescendant={activeIndex >= 0 ? id(activeIndex) : undefined}
      onKeyDown={keyDown}
      onFocus={scrollActiveOptionIntoView}
      className="group"
    >
      {items.map((entry, index) => (
        <li
          role="option"
          aria-selected={false}
          data-active={index === activeIndex}
          className="group-focus:data-[active=true]:bg-slate-700"
          key={entry.osm_id}
          id={id(index)}
          onClick={() => onSelectPlace(entry)}
        >
          <PlaceCard place={entry}></PlaceCard>
        </li>
      ))}
    </ul>
  );
}

function PlaceCard({
  place,
  isStandalone,
}: {
  place: PlaceResult;
  isStandalone?: boolean;
}) {
  const { address } = place;
  return (
    <div
      className={`flex items-center p-3 ${
        !isStandalone ? "hover:bg-sky-700" : ""
      }`}
    >
      <span className="pr-4 text-blue-100">{mapIcon}</span>
      <div>
        <div>
          {address.suburb
            ?.concat(", ")
            .concat(
              address.village ??
                address.town ??
                address.city ??
                address.municipality ??
                "",
            ) ?? place.name}
          , <span className="font-semibold">{address.state}</span>
        </div>
        {address.county && (
          <div className="text-sm text-blue-100">{address.county}</div>
        )}
      </div>
    </div>
  );
}

// from heroicons.com, MIT license (https://opensource.org/license/mit/)
const mapPinIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path
      fillRule="evenodd"
      d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
      clipRule="evenodd"
    />
  </svg>
);

const searchIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="h-5 w-5"
  >
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
      clipRule="evenodd"
    />
  </svg>
);

const mapIcon = (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-6 w-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
    />
  </svg>
);

const xIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-6 w-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const oneWayPlay = (
  <svg
    viewBox="30 99 137 47"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    fill="white"
    className="h-16"
    aria-label="Play"
  >
    <path d="m 134.52344,99.867187 c -0.36676,-0.0073 -0.71274,0.03838 -1.02539,0.142583 -0.80414,0.268 -1.97142,1.3264 -1.08203,3.90429 0.69415,2.01203 2.54687,5.60742 2.54687,5.60742 H 36.970703 v 25.95704 h 97.992187 c 0,0 -1.85272,3.59539 -2.54687,5.60742 -0.88939,2.57789 0.27789,3.63629 1.08203,3.90429 1.25063,0.41681 3.03808,-0.10466 4.53515,-1.19336 1.49635,-1.08817 18.69909,-14.11145 28.13477,-21.29687 -9.43568,-7.18542 -26.63842,-20.2087 -28.13477,-21.29687 -1.1228,-0.81653 -2.40949,-1.313977 -3.50976,-1.335943 z" />

    <text x="55" y="132" fill="currentColor" className="text-[28px] font-bold">
      PLAY
    </text>
  </svg>
);
