import type { Metadata } from "next";
import { getCatalog, browseProps } from "@/lib/catalog";
import { BrowseClient } from "@/app/skills/BrowseClient";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Search skills",
  description:
    "Search 12,000+ community Claude skills by name, creator, or topic — and install in a click, no terminal.",
};

export default async function SearchPage() {
  const catalog = await getCatalog();
  return <BrowseClient {...browseProps(catalog)} />;
}
