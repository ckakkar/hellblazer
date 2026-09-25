import { APP_BUNDLE_ID } from "@/lib/apple";

/**
 * Apple's universal-links file: with the iOS app installed, links to this
 * site open in the app instead of Safari. Sign-in and API paths stay in the
 * browser, so the website's Google redirect flow can't be pulled into the app.
 * Needs APPLE_TEAM_ID; 404 until it's set.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) return new Response(null, { status: 404 });
  return Response.json({
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${APP_BUNDLE_ID}`],
          components: [
            { "/": "/auth/*", exclude: true, comment: "Sign-in stays in the browser" },
            { "/": "/api/*", exclude: true, comment: "Files and data, not pages" },
            { "/": "/*" },
          ],
        },
      ],
    },
  });
}
