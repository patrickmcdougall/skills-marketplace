import { getBrowseSkills } from "@/lib/db";
import { BrowseClient } from "./BrowseClient";

export default async function BrowsePage() {
  const skills = await getBrowseSkills();
  return <BrowseClient initialSkills={skills} />;
}
