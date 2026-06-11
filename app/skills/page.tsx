import { getCatalog, browseProps } from "@/lib/catalog";
import { BrowseClient } from "./BrowseClient";

export const revalidate = 600;

export default async function SkillsPage() {
  const catalog = await getCatalog();
  return <BrowseClient {...browseProps(catalog)} />;
}
