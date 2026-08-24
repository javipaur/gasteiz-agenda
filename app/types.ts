// app/types.ts
export type Evento = {
    title: string;
    date: string;
    image: string;
    location: string;
    link: string;
    category: "agenda" | "inscripciones" | "excursiones"; // categorías permitidas
  };