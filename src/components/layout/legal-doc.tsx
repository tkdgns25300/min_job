export type LegalSection = { title: string; body: string | string[] };

// 법적 문서(약관·개인정보처리방침) 공용 셸 — 제목 + 초안 고지 + 조항 렌더.
// ⚠️ 내용은 각 페이지의 SECTIONS(초안). 정식 운영 전 법률 검토 필수 — ROADMAP 1-6.
export function LegalDoc({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          본 문서는 초안입니다. 서비스 정식 운영 전 법률 검토를 거쳐 확정되며, 시행일은 추후
          공지합니다.
        </p>
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
