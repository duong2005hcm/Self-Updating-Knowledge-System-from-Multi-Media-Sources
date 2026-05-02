export default function SectionHeading({ kicker, title, description, align = "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {kicker ? <span className="section-kicker">{kicker}</span> : null}
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
