export default function AdminPageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="section-kicker">Admin</div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-sm leading-7 text-slate-500">{description}</p>
        ) : null}
      </div>
      {action || null}
    </div>
  );
}
