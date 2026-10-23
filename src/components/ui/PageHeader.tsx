interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
  leadingVisual?: React.ReactNode;
  /**
   * `default` — admin pages (text-4xl title, text-lg description).
   * `compact` — customer pages (text-3xl extrabold title, text-sm
   * description), which sit under the app's nav and carry denser content.
   * See docs/template/DESIGN-SYSTEM.md "Page headers".
   */
  size?: "default" | "compact";
}

const SIZE_CLASSES = {
  default: {
    stack: "space-y-2",
    title: "text-4xl font-bold tracking-tight text-[#1a1a1a]",
    description: "text-[#1a1a1a]/60 text-lg",
  },
  compact: {
    stack: "space-y-1",
    title: "font-extrabold text-3xl tracking-tight text-[#1a1a1a]",
    description: "text-sm text-[#1a1a1a]/60",
  },
} as const;

export default function PageHeader({
  title,
  description,
  className = "",
  actions,
  leadingVisual,
  size = "default",
}: PageHeaderProps) {
  const classes = SIZE_CLASSES[size];
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 items-center gap-4">
      {leadingVisual}
      <div className={classes.stack}>
        <h1 className={classes.title}>{title}</h1>
        {description && (
          <p className={classes.description}>
            {description}
          </p>
        )}
      </div>
      </div>
      {actions && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
