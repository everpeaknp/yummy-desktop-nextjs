const appleApplicationId =
  process.env.APPLE_APP_LINK_APPLICATION_ID?.trim()
  || "3ANX28CC3Y.com.yummyever.mobile";

/** Apple Universal Link association for restaurant join links. */
export function GET() {
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appleApplicationId],
            components: [
              {
                "/": "/join",
                comment: "Open restaurant join links in the Yummy mobile app.",
              },
              {
                "/": "/invite",
                comment:
                  "Open verified-email restaurant invitations in the Yummy mobile app.",
              },
            ],
          },
        ],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
