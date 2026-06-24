const transactions = [
  { id: 1, lawyer: "Adele Irwin", type: "M&A", industry: "Tecnología", firm: "Firma A", country: "México" },
  { id: 2, lawyer: "Sin abogados listados", type: "M&A", industry: "Tecnología", firm: "Firma A", country: "México" }
];

const selectedLawyer = "Adele Irwin";
const filtered = transactions.filter(tx => {
  const matchLawyer = selectedLawyer === 'Todos' || (tx.lawyer || '').includes(selectedLawyer);
  return matchLawyer;
});

console.log("Matched transactions:", filtered.length);
