import { getDBPublisherRows } from "@/lib/db";
import { PublishersClient } from "./PublishersClient";

export default async function PublishersIndexPage() {
  const rows = await getDBPublisherRows();
  return <PublishersClient rawRows={rows} />;
}
