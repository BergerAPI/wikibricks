// Define the reusable category interface
export interface Category {
    id: string;
    name: string;
    children?: Category[];
}

// LEGO category hierarchy with English IDs and German names
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

const flattenCategories = (
    categories: Category[],
    depth: number = 0,
    path: string[] = []
): { id: string; name: string; depth: number; fullPath: string }[] => {
    const result: any[] = [];

    for (const cat of categories) {
        const fullPath = [...path, cat.name].join(" › ");

        result.push({
            id: cat.id,
            name: cat.name,
            depth,
            fullPath,
        });

        if (cat.children) {
            result.push(
                ...flattenCategories(cat.children, depth + 1, [...path, cat.name])
            );
        }
    }

    return result;
}

const flattenLeafCategories = (
    categories: Category[],
    path: string[] = []
): { id: string; name: string; fullPath: string }[] => {
    const result: any[] = [];

    for (const cat of categories) {
        const isLeaf = !cat.children || cat.children.length === 0;
        const fullPath = [...path, cat.name].join(" › ");

        if (isLeaf) {
            result.push({
                id: cat.id,
                name: cat.name,
                fullPath,
            });
        } else {
            result.push(
                ...flattenLeafCategories(cat.children!, [...path, cat.name])
            );
        }
    }

    return result;
}

// flattend for easier search
export const flattendLeafCategories = flattenLeafCategories(categories)
export const flattendCategories = flattenCategories(categories)