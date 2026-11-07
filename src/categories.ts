export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

// IDs are stable keys stored with the sets, names are shown to users
export const categories: Category[] = [
  {
    id: "lego",
    name: "Lego",
    children: [
      {
        id: "lego-architecture",
        name: "Architektur",
        children: [
          {
            id: "lego-architecture-city",
            name: "City",
            children: [
              { id: "lego-architecture-city-buildings", name: "Gebäude" },
              { id: "lego-architecture-city-vehicles", name: "Fahrzeuge" },
            ],
          },
        ],
      },
      {
        id: "lego-creator",
        name: "Creator",
        children: [
          { id: "lego-creator-objects", name: "Gegenstände" },
          { id: "lego-creator-retro", name: "Retro" },
        ],
      },
      {
        id: "lego-nature",
        name: "Natur",
        children: [
          { id: "lego-nature-farm", name: "Bauernhof" },
          { id: "lego-nature-zoo", name: "Zoo" },
          { id: "lego-nature-animals", name: "Tiere" },
          { id: "lego-nature-plants", name: "Pflanzen" },
        ],
      },
      {
        id: "lego-art",
        name: "Kunst",
        children: [{ id: "lego-art-dots", name: "Lego Dots" }],
      },
      { id: "lego-ideas", name: "Ideas" },
      {
        id: "lego-figures",
        name: "Figuren",
        children: [
          { id: "lego-figures-brickheads", name: "Brickheads" },
          { id: "lego-figures-minifigures", name: "Minifiguren" },
        ],
      },
      {
        id: "lego-series",
        name: "Serien",
        children: [
          { id: "lego-series-chima", name: "Chima" },
          { id: "lego-series-ninjago", name: "Ninjago" },
        ],
      },
      {
        id: "lego-licensed-products",
        name: "Lizenzprodukte",
        children: [
          { id: "lego-licensed-harry-potter", name: "Harry Potter" },
          { id: "lego-licensed-star-wars", name: "Star Wars" },
        ],
      },
      {
        id: "lego-duplo",
        name: "Lego Duplo",
        children: [
          { id: "lego-duplo-nature", name: "Natur" },
          { id: "lego-duplo-vehicles", name: "Fahrzeuge" },
          { id: "lego-duplo-minifigures", name: "Minifiguren" },
          { id: "lego-duplo-baby-toys", name: "Babyspielzeug" },
        ],
      },
      {
        id: "lego-duplo-primo",
        name: "Lego Duplo Primo",
        children: [
          { id: "lego-duplo-primo-nature", name: "Natur" },
          { id: "lego-duplo-primo-vehicles", name: "Fahrzeuge" },
          { id: "lego-duplo-primo-minifigures", name: "Minifiguren" },
        ],
      },
      { id: "lego-duplo-toolo", name: "Lego Duplo Toolo" },
      {
        id: "lego-technic",
        name: "Lego Technik",
        children: [
          { id: "lego-technic-vehicles", name: "Fahrzeuge" },
          { id: "lego-technic-bionicles", name: "Lego Bionicles" },
        ],
      },
      { id: "lego-modulex", name: "Lego Modulex" },
    ],
  },
];
