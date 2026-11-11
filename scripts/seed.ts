import type { CreateValues } from "@wikibricks/cms";
import bcrypt from "bcryptjs";
import { cms } from "../src/collections";
import { sql } from "../src/database";

type EntityType = (typeof cms.types)[number];

/**
 * Fills an empty database with users and sample entries, including some for moderators to review.
 */
export async function seed() {
  const password = await bcrypt.hash("password", 12);
  const users = await sql<{ id: number; username: string }[]>`
    INSERT INTO users ${sql([
      { username: "admin", password, permission_level: 9 },
      { username: "moderator", password, permission_level: 5 },
      { username: "alice", password, permission_level: 0 },
    ])}
    RETURNING id, username
  `;
  const user = Object.fromEntries(users.map((it) => [it.username, it.id]));

  // Goes through the same review as entries made in the app
  const add = async <T extends EntityType>(
    type: T,
    values: CreateValues<typeof cms.collections, T>,
    { authorId = user.admin, approve = true } = {},
  ) => {
    const { entityId, versionId } = await cms.create(type, { values, authorId });
    if (approve)
      await cms.review(entityId, versionId, {
        status: "approved",
        comment: "Looks good",
        reviewerId: user.moderator,
      });
    return entityId;
  };

  const lego = await add("brand", {
    name: "LEGO",
    description: "Danish toy company, founded in 1932.",
    country: "Denmark",
    website: "lego.com",
  });
  const cobi = await add("brand", {
    name: "Cobi",
    description: "Polish maker of construction blocks.",
    country: "Poland",
    website: "cobi.eu",
  });

  const farm = await add("set", {
    name: "Farm House",
    description: "A small farm with animals and a tractor.",
    pieces: 512,
    size: "M",
    theme: "lego-nature-farm",
    issued: "2019",
    brand_id: lego,
  });
  await add("set", {
    name: "Millennium Falcon",
    description: "The largest Star Wars set for a long time.",
    pieces: 7541,
    size: "XL",
    theme: "lego-licensed-star-wars",
    issued: "10.2017",
    brand_id: lego,
  });
  await add("set", {
    name: "Hogwarts Castle",
    description: "The castle with the Great Hall and towers.",
    pieces: 6020,
    size: "XL",
    theme: "lego-licensed-harry-potter",
    issued: "01.09.2018",
    brand_id: lego,
  });
  await add("set", {
    name: "City Bus",
    description: "A bus with a driver and passengers.",
    pieces: 280,
    size: "S",
    theme: "lego-architecture-city-vehicles",
    issued: "2021",
    brand_id: cobi,
  });
  await add("wiki", { name: "Sorting Bricks", description: "Sort by color first, then by shape." });

  // Something for the moderators to review
  await add(
    "set",
    {
      name: "Ninjago City",
      description: "A tall city with many floors.",
      pieces: 4867,
      size: "XL",
      theme: "lego-series-ninjago",
      issued: "2017",
      brand_id: lego,
    },
    { authorId: user.alice, approve: false },
  );
  await cms.propose(farm, {
    values: { description: "A small farm with animals, a tractor and a barn.", pieces: 520 },
    changeMessage: "Mention the barn and fix the piece count",
    authorId: user.alice,
  });

  console.log("Added sample data");
}
