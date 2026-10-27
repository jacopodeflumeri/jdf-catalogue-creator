"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormInput from "@/components/ui/form/FormInput";
import FormSelect from "@/components/ui/form/FormSelect";
import Modal from "@/components/ui/modal/Modal";
import NoticeBox from "@/components/ui/NoticeBox";
import { CATALOG_PROFILES } from "@/modules/synthetic_catalog/config/profiles";
import type { CatalogOverviewView } from "@/modules/synthetic_catalog/admin/types";
import { createSyntheticCatalogAction } from "@/modules/synthetic_catalog/server/admin-actions";

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function NewCatalogModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: CatalogOverviewView[] }) {
  const router = useRouter();
  const templates = useMemo(() => catalogs.length ? catalogs.map((catalog) => ({ value: `catalog:${catalog.slug}`, label: catalog.name })) : CATALOG_PROFILES.map((profile) => ({ value: `profile:${profile.slug}`, label: profile.name })), [catalogs]);
  const [name, setName] = useState(""); const [brandName, setBrandName] = useState(""); const [segment, setSegment] = useState(""); const [slug, setSlug] = useState(""); const [prefix, setPrefix] = useState(""); const [template, setTemplate] = useState(templates[0]?.value ?? "");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  function changeName(value: string) { setName(value); setSlug(slugify(value)); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const result = await createSyntheticCatalogAction({ name, brandName, segment, slug, externalPrefix: prefix, template });
    setBusy(false);
    if (!result.ok || !result.slug) { setMessage(result.message ?? "Could not create catalogue"); return; }
    onClose(); router.refresh(); router.push(`/admin/catalogs/${result.slug}`);
  }
  return <Modal isOpen={open} onClose={onClose} title="New catalogue" size="md">
    <form id="new-catalog-form" className="space-y-4" onSubmit={submit}>
      {message && <NoticeBox variant="error">{message}</NoticeBox>}
      <FormInput id="new-catalog-name" label="Catalogue name" value={name} onChange={(event) => changeName(event.target.value)} required maxLength={100} />
      <div className="grid gap-4 sm:grid-cols-2"><FormInput id="new-catalog-brand" label="Brand name" value={brandName} onChange={(event) => setBrandName(event.target.value)} required maxLength={80} /><FormInput id="new-catalog-segment" label="Segment" value={segment} onChange={(event) => setSegment(event.target.value)} required maxLength={80} /></div>
      <FormInput id="new-catalog-slug" label="Slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} helpText="Lowercase letters, numbers, and single hyphens." />
      <FormInput id="new-catalog-prefix" label="External product prefix" value={prefix} onChange={(event) => setPrefix(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} required pattern="[A-Z]{3}" maxLength={3} helpText="Exactly three uppercase letters; product IDs begin with this prefix." />
      <FormSelect id="new-catalog-template" label="Configuration template" value={template} onChange={(event) => setTemplate(event.target.value)} options={templates} />
      <div className="flex justify-end gap-3 pt-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" loading={busy}>Create catalogue</Button></div>
    </form>
  </Modal>;
}
