import React, { useState } from "react";

export default function Procedimentos() {
  const [procedures, setProcedures] = useState([
    { id: 1, name: "Design de sobrancelha", price: 20, product_percent: 10 },
  ]);
  const [newProcedure, setNewProcedure] = useState("");

  const addProcedure = () => {
    if (newProcedure.trim() === "") return;
    setProcedures([
      ...procedures,
      {
        id: procedures.length + 1,
        name: newProcedure,
        price: 0,
        product_percent: 0,
      },
    ]);
    setNewProcedure("");
  };

  return (
    <div>
      <h2>Procedimentos</h2>
      <ul>
        {procedures.map((p) => (
          <li key={p.id}>
            {p.name} - €{p.price} - {p.product_percent}%
          </li>
        ))}
      </ul>

      <input
        placeholder="Novo Procedimento"
        value={newProcedure}
        onChange={(e) => setNewProcedure(e.target.value)}
      />
      <button onClick={addProcedure}>Adicionar</button>
    </div>
  );
}
