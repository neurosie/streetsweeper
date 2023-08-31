import dynamic from "next/dynamic";

export const DynamicMap = dynamic(() => import("./LeafletMap"), { ssr: false });
