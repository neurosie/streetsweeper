/* Based on https://github.com/sickdyd/react-search-autocomplete */

import { Combobox } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { ChangeEvent, useState } from "react";
import { api } from "~/utils/api";

export default function SearchBox() {
  const [selectedOption, setSelectedOption] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  return (
    <div className="fixed top-16 w-72 md:w-96">
      <Combobox value={selectedOption} onChange={setSelectedOption}>
        <div className="relative mt-1">
          <div className="relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-teal-300 sm:text-sm">
            <Combobox.Input
              className="w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-gray-900 focus:ring-0"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {debouncedSearchTerm.length > 0 && (
            <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              <SearchSuggestions searchTerm={debouncedSearchTerm} />
            </Combobox.Options>
          )}
        </div>
      </Combobox>
    </div>
  );
}

function SearchSuggestions({ searchTerm }: { searchTerm: string }) {
  const { status, data, error } = api.search.get.useQuery({
    query: searchTerm,
  });

  if (status === "loading") {
    return <span>loading...</span>;
  }
  if (status === "error") {
    return <span>Error: {error.message}</span>;
  }
  return (
    <div>
      {data.map((entry) => (
        <Combobox.Option
          key={entry.place_id}
          className={({ active }) =>
            `relative cursor-default select-none px-4 py-2 ${
              active ? "bg-pink-600 text-white" : "text-gray-900"
            }`
          }
          value={entry.place_id}
        >
          {({ selected, active }) => (
            <>
              <span
                className={`block truncate ${
                  selected ? "font-medium" : "font-normal"
                }`}
              >
                {entry.display_name}
              </span>
            </>
          )}
        </Combobox.Option>
      ))}
    </div>
  );
}
