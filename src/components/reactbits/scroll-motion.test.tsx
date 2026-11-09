import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitText } from "./split-text";
import { ScrollFloat } from "./scroll-float";
import { ScrollReveal } from "./scroll-reveal";
import { ScrollStack, ScrollStackItem } from "./scroll-stack";
import { ScrollExpand } from "./scroll-expand";

describe("scroll kit's readable server output", () => {
  it("keeps combined emoji and accented graphemes whole, with real word spaces and line breaks", () => {
    const text = "A👨‍👩‍👧‍👦 é\nB";
    const html = renderToStaticMarkup(<SplitText text={text} as="h1" />);
    expect(html).toContain(`<span class="sr-only">${text}</span>`);
    expect(html).not.toContain("aria-label");
    expect(html.match(/class="rb-motion-char"/g)).toHaveLength(4);
    expect(html).toContain("👨‍👩‍👧‍👦</span>");
    expect(html).toContain("é</span>");
    expect(html).toContain('</span> <span aria-hidden="true"');
    expect(html).toContain('<br aria-hidden="true"/>');
  });

  it("renders headline and statement text accessibly without client effects", () => {
    expect(renderToStaticMarkup(<ScrollFloat text="Start at the bottom." />)).toContain('<span class="sr-only">Start at the bottom.</span>');
    const html = renderToStaticMarkup(<ScrollReveal text="Log. Lift. Repeat." dim={0.2} />);
    expect(html).toContain('<span class="sr-only">Log. Lift. Repeat.</span>');
    expect(html).not.toContain("aria-label");
    expect(html.match(/rb-reveal-word/g)).toHaveLength(3);
    expect(html).toContain('--motion-dim:0.2');
    expect(html).toContain('aria-hidden="true"');
  });

  it("keeps every card and the finale in normal server content order", () => {
    const html = renderToStaticMarkup(<ScrollStack><ScrollStackItem>First round</ScrollStackItem><ScrollStackItem>Second round</ScrollStackItem></ScrollStack>);
    expect(html.indexOf("First round")).toBeLessThan(html.indexOf("Second round"));
    expect(html.match(/data-covered="true"/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<ScrollExpand><button>Sign in</button></ScrollExpand>)).toContain('<button>Sign in</button>');
  });
});
