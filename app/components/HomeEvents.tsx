import HomeEventsClient from "./HomeEventsClient";
import { getProximosEventos } from "@/lib/eventos";

export default async function HomeEvents() {
  const eventos = await getProximosEventos();

  return <HomeEventsClient eventos={eventos} />;
}
