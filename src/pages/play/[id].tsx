import { useRouter } from "next/router";
import MapboxMap from "~/components/MapboxMap";
import { api } from "~/utils/api";

export default function Play() {
  const router = useRouter();
  const id = router.query.id as string | undefined;
  const { status, data, error } = api.place.getById.useQuery(
    { id: id as string },
    { enabled: !!id },
  );
  console.log(data);

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        {/* {data ? data.toString() : "loading..."} */}
        <MapboxMap data={data} />
      </main>
    </>
  );
}
