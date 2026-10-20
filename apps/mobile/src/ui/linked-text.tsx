import { Text, TextTone, TextVariant } from './text';

export interface TextLink {
  label: string;
  onPress: () => void;
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

export function LinkedText({ template, links, variant = TextVariant.Label }: { template: string; links: Record<string, TextLink>; variant?: TextVariant }) {
  return (
    <Text variant={variant}>
      {splitTemplate(template).map((part, index) => {
        const link = part.key ? links[part.key] : undefined;
        return link ? (
          <Text key={index} variant={variant} tone={TextTone.Primary} onPress={link.onPress} accessibilityRole="link" style={{ textDecorationLine: 'underline' }}>
            {link.label}
          </Text>
        ) : (
          part.text
        );
      })}
    </Text>
  );
}
