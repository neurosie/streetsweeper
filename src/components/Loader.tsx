import { useEffect } from "react";

export default function Loader() {
  useEffect(() => {
    async function getLoader() {
      const { squircle } = await import("ldrs");
      squircle.register();
    }
    void getLoader();
  }, []);
  return <l-squircle color="white"></l-squircle>;
}
