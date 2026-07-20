export type LegalSection = { title: string; body: string | string[] };

// 법적 문서(약관·개인정보처리방침) 공용 셸 — 제목 + 시행일 + 조항 렌더.
// ⚠️ 사용자에게는 확정본으로 노출하되, 정식 운영 전 법률 재검토 예정 — ROADMAP 1-6.
export function LegalDoc({
  title,
  sections,
  effectiveDate,
}: {
  title: string;
  sections: LegalSection[];
  effectiveDate?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {effectiveDate && <p className="text-sm text-muted-foreground">시행일 {effectiveDate}</p>}
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="font-bold">{section.title}</h2>
            {Array.isArray(section.body) ? (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/40">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
