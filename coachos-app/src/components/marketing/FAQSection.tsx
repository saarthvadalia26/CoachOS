const faqs = [
  {
    question: "Is CoachOS for multi-branch institutes?",
    answer:
      "Yes. CoachOS is designed around an institute with one or more branches, so owners can keep visibility while branch teams manage daily work.",
  },
  {
    question: "Can staff use separate accounts?",
    answer:
      "Yes. Staff members can be assigned roles such as branch manager, accountant, operations staff, academic coordinator, or teacher.",
  },
  {
    question: "Does it support attendance and fee tracking?",
    answer:
      "Yes. CoachOS includes attendance submission, audit history, fee records, payment status, and CSV exports for internal records.",
  },
  {
    question: "Is student data protected?",
    answer:
      "CoachOS uses authenticated access, branch-aware permissions, and role-based visibility so team members only access the data their role allows.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          FAQ
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Questions institute owners usually ask first.
        </h2>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {faqs.map((faq) => (
          <article
            key={faq.question}
            className="rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <h3 className="font-semibold">{faq.question}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
