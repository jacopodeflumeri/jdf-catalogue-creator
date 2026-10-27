"use client";

import { useId, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

export default function CollapsibleCard({ title, description, headerActions, children, defaultExpanded = false, className }: { title: string; description?: string; headerActions?: React.ReactNode; children: React.ReactNode; defaultExpanded?: boolean; className?: string }) {
  const [expanded, setExpanded] = useState(defaultExpanded); const contentId = useId();
  return <Card title={title} description={description} className={className} headerActions={<div className="flex items-center gap-2">{headerActions}<Button type="button" variant="ghost" size="sm" aria-expanded={expanded} aria-controls={contentId} aria-label={`${expanded ? "Collapse" : "Expand"} ${typeof title === "string" ? title : "card"}`} onClick={() => setExpanded((value) => !value)}><Icon type={expanded ? "chevron-up" : "chevron-down"} size="sm" /></Button></div>}>
    <div id={contentId} hidden={!expanded}>{children}</div>
  </Card>;
}
