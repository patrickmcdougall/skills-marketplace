import { getDBPublisherRows } from "@/lib/db";
import { CreatorsClient } from "./CreatorsClient";

export default async function CreatorsIndexPage() {
  const rows = await getDBPublisherRows();
  return <CreatorsClient rawRows={rows} />;
}
