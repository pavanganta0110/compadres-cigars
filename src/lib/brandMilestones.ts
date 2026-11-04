export type Milestone = { year: string; text: string };
export type BrandMilestones = { eyebrow: string; title: string; items: Milestone[] };

/** Career milestones shown on a brand page, keyed by the brand template. */
export const BRAND_MILESTONES: Partial<Record<"isley", BrandMilestones>> = {
  isley: {
    eyebrow: "A life in music",
    title: "Six decades of soul",
    items: [
      { year: "1941", text: "Born in Cincinnati, Ohio, on May 21" },
      { year: "1959", text: "The Isley Brothers release their debut single, “Shout”" },
      { year: "1969", text: "T-Neck Records is relaunched with his brothers" },
      { year: "1973", text: "The landmark album 3 + 3 reshapes the group's sound" },
      { year: "1990", text: "A top-ten duet with Rod Stewart, “This Old Heart of Mine”" },
      { year: "1992", text: "Inducted into the Rock and Roll Hall of Fame with The Isley Brothers" },
      { year: "2010", text: "Steps out solo with his first album, Mr. I" },
      { year: "2016", text: "Berklee College of Music awards him an honorary doctorate of music" },
    ],
  },
};
