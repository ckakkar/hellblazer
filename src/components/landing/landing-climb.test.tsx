import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TIERS } from "@/lib/tiers";

vi.mock("@/components/tier/fighter-art", () => ({ FighterArt: ({ fighterKey, sizes, priority }: { fighterKey: string; sizes: string; priority?: boolean }) => <figure data-fighter={fighterKey} data-sizes={sizes} data-priority={String(Boolean(priority))} /> }));
vi.mock("@/components/ui/sheet", () => ({ Sheet: () => null }));
const { LandingClimb } = await import("./landing-climb");

describe("the server-rendered climb", () => {
  it("keeps every fighter in a real ordered, actionable ladder from bottom to summit", () => {
    const html = renderToStaticMarkup(<LandingClimb />);
    const list = html.slice(html.indexOf('<ol class="climb-roster"'), html.indexOf("</ol>"));
    expect(list.match(/<li /g)).toHaveLength(10);
    for (const fighter of TIERS) expect(list).toContain(`Rank ${fighter.rank}, ${fighter.name}, ${fighter.epithet}. Read their file`);
    expect(list.indexOf("Rei Mikazuchi")).toBeLessThan(list.indexOf("Kuroki Gensai"));
    expect(html).toContain("Everyone<br/>starts<br/>unranked.");
    expect(html).toContain("The judge moves you up.");
  });

  it("never gives a portrait priority and caps the phone image slot at 320px", () => {
    const html = renderToStaticMarkup(<LandingClimb />);
    expect(html).not.toContain('data-priority="true"');
    expect(html.match(/data-sizes="\(max-width: 744px\) 320px, 640px"/g)).toHaveLength(20);
  });
});
