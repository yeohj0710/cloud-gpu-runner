const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const decode = (value) =>
  String(value || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const first = (text, pattern) => decode(text.match(pattern)?.[1]);
export async function searchPubMed(query, limit = 50) {
  const size = Math.min(200, Math.max(1, Number(limit) || 50));
  const search = await fetch(
    `${BASE}/esearch.fcgi?db=pubmed&retmode=json&sort=pub+date&retmax=${size}&term=${encodeURIComponent(query)}&tool=cloud-gpu-runner-console&email=research@wellnessbox.kr`,
    { cache: "no-store" },
  );
  if (!search.ok) throw new Error(`PubMed search HTTP ${search.status}`);
  const found = await search.json(),
    ids = found.esearchresult?.idlist || [];
  if (!ids.length)
    return { total: Number(found.esearchresult?.count || 0), items: [] };
  const fetched = await fetch(
    `${BASE}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}&tool=cloud-gpu-runner-console&email=research@wellnessbox.kr`,
    { cache: "no-store" },
  );
  if (!fetched.ok) throw new Error(`PubMed fetch HTTP ${fetched.status}`);
  const xml = await fetched.text(),
    articles = [
      ...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g),
    ].map((match) => {
      const block = match[1],
        pmid = first(block, /<PMID[^>]*>([\s\S]*?)<\/PMID>/),
        title = first(block, /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/),
        abstract = [
          ...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
        ]
          .map((x) => decode(x[1]))
          .join(" ");
      const doi =
        [
          ...block.matchAll(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/g),
        ].map((x) => decode(x[1]))[0] || "";
      return {
        pmid,
        title,
        abstract,
        journal:
          first(block, /<Title>([\s\S]*?)<\/Title>/) ||
          first(block, /<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/),
        year:
          first(block, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ||
          first(block, /<MedlineDate>(\d{4})/),
        doi,
        authors: [
          ...block.matchAll(
            /<Author[^>]*>[\s\S]*?<LastName>([\s\S]*?)<\/LastName>[\s\S]*?(?:<ForeName>([\s\S]*?)<\/ForeName>)?[\s\S]*?<\/Author>/g,
          ),
        ]
          .slice(0, 8)
          .map((x) => `${decode(x[2])} ${decode(x[1])}`.trim())
          .join(", "),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    });
  return {
    total: Number(found.esearchresult?.count || articles.length),
    items: [...new Map(articles.map((x) => [x.pmid, x])).values()],
  };
}
export function pubmedCsv(items) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    "PMID,Year,Title,Authors,Journal,DOI,Abstract,URL",
    ...items.map((x) =>
      [x.pmid, x.year, x.title, x.authors, x.journal, x.doi, x.abstract, x.url]
        .map(q)
        .join(","),
    ),
  ].join("\r\n");
}
