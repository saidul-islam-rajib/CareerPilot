export interface TextLink {
  label: string;
  href: string;
}

const PLACEHOLDER = /(\{\w+\})/;

export function splitTemplate(template: string): Array<{ text: string; key?: string }> {
  return template
    .split(PLACEHOLDER)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = /^\{(\w+)\}$/.exec(part);
      return match ? { text: part, key: match[1] } : { text: part };
    });
}

export function LinkedText({ template, links }: { template: string; links: Record<string, TextLink> }) {
  return (
    <>
      {splitTemplate(template).map((part, index) => {
        const link = part.key ? links[part.key] : undefined;
        return link ? (
          <a key={index} href={link.href} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
            {link.label}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        );
      })}
    </>
  );
}
