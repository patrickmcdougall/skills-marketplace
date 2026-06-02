import { getDBPublisherRows, getPublisherProfiles, type PublisherProfile } from "@/lib/db";
import { CreatorsClient } from "./CreatorsClient";

export default async function CreatorsIndexPage() {
  const rows = await getDBPublisherRows();
  const profileMap = await getPublisherProfiles(rows.map((r) => r.handle));
  const profiles: Record<string, PublisherProfile> = Object.fromEntries(profileMap);
  return <CreatorsClient rawRows={rows} profiles={profiles} />;
}
